import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { upstreamAAdapter } from './adapters/upstreamA';
import { handleDownloadRequest } from './download';
import { handleMediaMaster, handleMediaPart } from './media';
import { handleProxyRequest } from './proxy';
import { resolveDirectSources } from './resolvers';
import { signMediaUrl } from './signing';
import { regionalSeasonGuide } from './catalog';
import type { Env, MediaRequest, StreamRecord, ResolutionObserver } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'] }));
app.get('/health', (context) => context.json({ ok: true, serviceVersion: context.env.SERVICE_VERSION || 'dev' }));
app.get('/catalog/tv/:tmdbId', async context => {
  const title = context.req.query('title')?.trim();
  const year = Number(context.req.query('year')) || undefined;
  if (!positiveInt(context.req.param('tmdbId')) || !title || title.length > 160 || (year && (year < 1900 || year > 2100))) return context.json({ error: 'Invalid series' }, 400);
  try {
    const guide = await regionalSeasonGuide(title, year, AbortSignal.any([context.req.raw.signal, AbortSignal.timeout(10_000)]));
    context.header('Cache-Control', 'public, max-age=300');
    return context.json(guide);
  } catch { return context.json({ error: 'Secondary catalog is temporarily unavailable', seasons: [] }, 503); }
});
app.get('/proxy', (context) => handleProxyRequest(context.req.raw, context.env));
app.get('/download', (context) => handleDownloadRequest(context.req.raw, context.env));
app.get('/media/:id/master.m3u8', (context) => handleMediaMaster(context.req.raw, context.env, context.req.param('id')));
app.get('/media/:id/seg/:index', (context) => handleMediaPart(context.req.raw, context.env, context.req.param('id'), 'seg', context.req.param('index')));
app.get('/media/:id/asset/:index', (context) => handleMediaPart(context.req.raw, context.env, context.req.param('id'), 'asset', context.req.param('index')));
app.get('/version', (context) => {
  return context.json({
    serviceVersion: context.env.SERVICE_VERSION || 'dev',
    adapters: Object.fromEntries([
      ['local', context.env.LOCAL_SCRAPER_URL ? 'configured' : 'unconfigured'],
      ['render', context.env.RENDER_SCRAPER_URL ? 'configured' : 'unconfigured'],
      ['A', context.env.UPSTREAM_A_URL ? 'configured' : 'unconfigured'],
    ]),
    features: {
      directResolvers: context.env.DIRECT_RESOLVERS === 'true' ? 'enabled' : 'disabled',
      mediaProxy: context.env.PROXY_SECRET ? 'configured' : 'unconfigured',
    },
    broken_sources: [...brokenSources(context.env)],
  });
});

app.get('/stream/movie/:tmdbId', async (context) => {
  const tmdbId = positiveInt(context.req.param('tmdbId'));
  if (!tmdbId) return context.json({ error: 'Invalid TMDB id' }, 400);
  return playbackResponse({ kind: 'movie', tmdbId }, context);
});

app.get('/stream/tv/:tmdbId/:season/:episode', async (context) => {
  const tmdbId = positiveInt(context.req.param('tmdbId'));
  const season = positiveInt(context.req.param('season'));
  const episode = positiveInt(context.req.param('episode'));
  if (!tmdbId || !season || !episode) return context.json({ error: 'Invalid series or episode id' }, 400);
  return playbackResponse({ kind: 'tv', tmdbId, season, episode }, context);
});

app.notFound((context) => context.json({ error: 'Not found' }, 404));

type AppContext = Context<{ Bindings: Env }>;

async function playbackResponse(request: MediaRequest, context: AppContext) {
  if (!context.req.header('Accept')?.includes('application/x-ndjson')) {
    return context.json({ streams: await resolveStreams(request, context) });
  }
  const cancellation = new AbortController();
  const signal = AbortSignal.any([context.req.raw.signal, cancellation.signal, AbortSignal.timeout(25_000)]);
  const stats = { checked: 0, failed: 0, empty: 0 };
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (value: object) => { if (!closed) controller.enqueue(new TextEncoder().encode(`${JSON.stringify(value)}\n`)); };
      void resolveStreams(request, context, {
        onStream: stream => send({ type: 'source', stream }),
        onResult: result => { stats.checked++; if (result === 'unavailable') stats.failed++; if (result === 'empty') stats.empty++; },
      }, signal).then(streams => send({ type: 'done', count: streams.length, ...stats }))
        .catch(() => send({ type: 'error', message: 'Playback providers are temporarily unavailable.' }))
        .finally(() => { if (!closed) { closed = true; controller.close(); } });
    },
    cancel() { closed = true; cancellation.abort(); },
  });
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function resolveStreams(request: MediaRequest, context: AppContext, observer: ResolutionObserver = {}, signal = context.req.raw.signal): Promise<StreamRecord[]> {
  const excludeValue = context.req.query('exclude');
  const excluded = new Set((excludeValue || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
  const proxyBase = new URL(context.req.url).origin;
  const published = new Map<string, Promise<StreamRecord>>();
  const publish = (stream: StreamRecord) => {
    if ([stream.id, stream.name, stream.source].some(value => value && excluded.has(value.toLowerCase()))) return;
    if (published.has(stream.url)) return;
    published.set(stream.url, signStreams([stream], context.env, proxyBase).then(([signed]) => {
      observer.onStream?.(signed);
      return signed;
    }));
  };
  const [direct, fallback] = await Promise.all([
    resolveDirectSources(request, context.env, proxyBase, signal, { onStream: publish, onResult: observer.onResult }),
    resolveWithFallback(request, excludeValue, context.env, signal, { onStream: publish, onResult: observer.onResult }),
  ]);
  const directStreams = direct.filter((stream) => ![stream.id, stream.name, stream.source]
    .some((value) => value && excluded.has(value.toLowerCase())));

  [...directStreams, ...fallback].forEach(publish);
  return Promise.all(published.values());
}

async function signStreams(streams: StreamRecord[], env: Env, proxyBase: string): Promise<StreamRecord[]> {
  if (!env.PROXY_SECRET) return streams;
  return Promise.all(streams.map(async (stream) => {
    // Stateless signed URLs preserve master variants, audio and captions and survive cache eviction.
    const signed = await signMediaUrl(stream.url, stream.headers, env, proxyBase);
    if (signed === stream.url) return stream;
    const subtitles = await Promise.all(stream.subtitles.map(async track => ({ ...track, url: await signMediaUrl(track.url, stream.headers, env, proxyBase, true) })));
    return { ...stream, url: signed, subtitles, headers: {}, expiresAt: Math.max(stream.expiresAt, Date.now() + 6 * 60 * 60 * 1000) };
  }));
}

async function resolveWithFallback(request: MediaRequest, excludeValue: string | undefined, env: Env, signal: AbortSignal, observer: ResolutionObserver): Promise<StreamRecord[]> {
  const excluded = new Set((excludeValue || '').split(',').map((value) => value.trim()).filter(Boolean));
  const broken = brokenSources(env);

  // Resolve the requested title only; never replace it with a demo clip.
  const sources = [
    { id: 'local', url: env.LOCAL_SCRAPER_URL },
    { id: 'render', url: env.RENDER_SCRAPER_URL },
    { id: 'A', url: env.UPSTREAM_A_URL },
  ];

  const results = await Promise.allSettled(sources.map(async (source) => {
    if (!source.url || excluded.has(source.id) || broken.has(source.id)) return [];
    try {
      const upstreamSignal = AbortSignal.any([signal, AbortSignal.timeout(20_000)]);
      const streams = source.id === 'A' ? await upstreamAAdapter.resolve(request, upstreamSignal, env)
        : await fetchFromSource(source.url, request, excluded, upstreamSignal);
      const usable = streams.filter(stream => !excluded.has(stream.source) && !broken.has(stream.source));
      observer.onResult?.(usable.length ? 'ok' : 'empty');
      usable.forEach(stream => observer.onStream?.(stream));
      return usable;
    } catch (error) { observer.onResult?.('unavailable'); throw error; }
  }));
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);

}

async function fetchFromSource(baseUrl: string, request: MediaRequest, excluded: Set<string>, signal: AbortSignal): Promise<StreamRecord[]> {
  const path = request.kind === 'movie'
    ? `/stream/movie/${request.tmdbId}`
    : `/stream/tv/${request.tmdbId}/${request.season}/${request.episode}`;
  
  const url = new URL(path, baseUrl);
  url.searchParams.set('exclude', [...excluded].join(','));
  const response = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });
  
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const data = await response.json<{ streams?: StreamRecord[] }>();
  return data.streams || [];
}

function brokenSources(env: Env): Set<string> {
  return new Set((env.BROKEN_SOURCES || '').split(',').map((value) => value.trim()).filter(Boolean));
}

function positiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export default app;
export { brokenSources, positiveInt };
