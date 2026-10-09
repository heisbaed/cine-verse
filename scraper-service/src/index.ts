import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { upstreamAAdapter } from './adapters/upstreamA';
import { torboxAdapter } from './adapters/torbox';
import type { Adapter, Env, MediaRequest, StreamRecord } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'] }));
app.get('/health', (context) => context.json({ ok: true, serviceVersion: context.env.SERVICE_VERSION || 'dev' }));
app.get('/version', (context) => {
  const broken = brokenSources(context.env);
  return context.json({
    serviceVersion: context.env.SERVICE_VERSION || 'dev',
    adapters: Object.fromEntries([
      ['local', context.env.LOCAL_SCRAPER_URL ? 'configured' : 'unconfigured'],
      ['render', context.env.RENDER_SCRAPER_URL ? 'configured' : 'unconfigured'],
      ['torbox', context.env.TORBOX_TOKEN ? 'configured' : 'unconfigured'],
    ]),
    broken_sources: [...brokenSources(context.env)],
  });
});

app.get('/stream/movie/:tmdbId', async (context) => {
  const tmdbId = positiveInt(context.req.param('tmdbId'));
  if (!tmdbId) return context.json({ error: 'Invalid TMDB id' }, 400);
  return context.json({ streams: await resolveWithFallback({ kind: 'movie', tmdbId }, context.req.query('exclude'), context.env) });
});

app.get('/stream/tv/:tmdbId/:season/:episode', async (context) => {
  const tmdbId = positiveInt(context.req.param('tmdbId'));
  const season = positiveInt(context.req.param('season'));
  const episode = positiveInt(context.req.param('episode'));
  if (!tmdbId || !season || !episode) return context.json({ error: 'Invalid series or episode id' }, 400);
  return context.json({ streams: await resolveWithFallback({ kind: 'tv', tmdbId, season, episode }, context.req.query('exclude'), context.env) });
});

app.notFound((context) => context.json({ error: 'Not found' }, 404));

async function resolveWithFallback(request: MediaRequest, excludeValue: string | undefined, env: Env): Promise<StreamRecord[]> {
  const excluded = new Set((excludeValue || '').split(',').map((value) => value.trim()).filter(Boolean));
  const broken = brokenSources(env);

  // Try sources in order: LOCAL → RENDER → TORBOX → DEMO
  const sources = [
    { id: 'local', url: env.LOCAL_SCRAPER_URL },
    { id: 'render', url: env.RENDER_SCRAPER_URL },
    { id: 'torbox', url: null },
  ];

  for (const source of sources) {
    if (excluded.has(source.id) || brokenSources(env).has(source.id)) continue;
    
    let streams: StreamRecord[] = [];
    try {
      if (source.id === 'local' && source.url) {
        streams = await fetchFromSource(source.url, request, env);
      } else if (source.id === 'render' && source.url) {
        streams = await fetchFromSource(source.url, request, env);
      } else if (source.id === 'torbox') {
        const settled = await Promise.allSettled([
          withTimeout(torboxAdapter, request, env),
        ]);
        streams = settled.flatMap((r) => r.status === 'fulfilled' ? r.value : []);
      }
      
      if (streams.length > 0) {
        console.log(`[Fallback] Source "${source.id}" returned ${streams.length} streams`);
        return streams;
      }
    } catch (e) {
      console.log(`[Fallback] Source "${source.id}" failed:`, e);
    }
  }

  // Last resort: demo streams
  console.log('[Fallback] All sources failed, returning demo streams');
  return [{
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    headers: {},
    quality: '1080p',
    subtitles: [],
    source: 'demo',
    expiresAt: Date.now() + 60 * 60_000,
  }];
}

async function fetchFromSource(baseUrl: string, request: MediaRequest, env: Env): Promise<StreamRecord[]> {
  const path = request.kind === 'movie'
    ? `/stream/movie/${request.tmdbId}`
    : `/stream/tv/${request.tmdbId}/${request.season}/${request.episode}`;
  
  const response = await fetch(new URL(path, baseUrl), {
    signal: AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const data = await response.json<{ streams?: StreamRecord[] }>();
  return data.streams || [];
}

function brokenSources(env: Env): Set<string> {
  return new Set((env.BROKEN_SOURCES || '').split(',').map((value) => value.trim()).filter(Boolean));
}

async function withTimeout(adapter: Adapter, request: MediaRequest, env: Env): Promise<StreamRecord[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('Adapter timeout'), 15_000);
  try { return await adapter.resolve(request, controller.signal, env); }
  finally { clearTimeout(timeout); }
}

function positiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default app;
export { brokenSources, positiveInt };