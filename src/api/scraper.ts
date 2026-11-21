import type { PlaybackRequest, PlaybackSource, SubtitleSource } from '@/types/playback';
import { assertEpisodeReleased } from './episodeRelease';

const DEV_SCRAPER_BASE = 'http://127.0.0.1:8787';
const PRODUCTION_SCRAPER_BASE = 'https://cineverse-stream-service.charlesbabuu0.workers.dev';

function scraperBase(): string {
  const configured = import.meta.env.VITE_SCRAPER_BASE;
  if (typeof configured === 'string' && configured.trim()) {
    try {
      const url = new URL(configured.trim());
      if (import.meta.env.DEV || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return url.origin;
    } catch { /* Use the deployed service when a build has an invalid local override. */ }
  }
  return import.meta.env.DEV ? DEV_SCRAPER_BASE : PRODUCTION_SCRAPER_BASE;
}

export const isScraperConfigured = (): boolean => Boolean(scraperBase());

export async function fetchCatalogCaptions(kind: 'movie' | 'tv', id: string, signal: AbortSignal): Promise<SubtitleSource[]> {
  const response = await fetch(new URL(`/captions/${kind === 'tv' ? 'series' : 'movie'}/${encodeURIComponent(id)}`, scraperBase()), { signal });
  if (!response.ok) throw new Error('Subtitle lookup is temporarily unavailable.');
  const tracks = await response.json() as { lang: string; version: number; url: string }[];
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  return tracks.map(({ lang, version, url }) => {
    let label = lang;
    try { label = names.of(lang) || lang; } catch { /* Preserve provider language labels. */ }
    return { url, label: version > 1 ? `${label} · ${version}` : label };
  });
}

function streamPath(request: PlaybackRequest): string {
  if (request.kind === 'movie') return `/stream/movie/${request.tmdbId}`;
  return `/stream/tv/${request.tmdbId}/${request.season}/${request.episode}`;
}

function valid(request: PlaybackRequest): boolean {
  if (!Number.isSafeInteger(request.tmdbId) || request.tmdbId <= 0) return false;
  if (request.kind === 'movie') return true;
  return Boolean(
    Number.isSafeInteger(request.season) &&
    Number.isSafeInteger(request.episode) &&
    request.season! > 0 &&
    request.episode! > 0,
  );
}

function contentTypeOf(url: string): PlaybackSource['contentType'] {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return 'hls';
  if (/\.mpd(?:$|[?#])/i.test(url)) return 'dash';
  if (/\.(mp4|webm|mkv|mov|m4v)(?:$|[?#])/i.test(url)) return 'progressive';
  return undefined;
}

function normalize(raw: Record<string, unknown>, index: number): PlaybackSource | null {
  const url = typeof raw.url === 'string' ? raw.url : '';
  if (!/^https?:\/\//i.test(url)) return null;
  const headers: Record<string, string> = {};
  if (raw.headers && typeof raw.headers === 'object') {
    for (const [key, value] of Object.entries(raw.headers as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) headers[key] = value;
    }
  }
  const subtitles: SubtitleSource[] = Array.isArray(raw.subtitles)
    ? raw.subtitles.flatMap((track): SubtitleSource[] => {
        if (!track || typeof track !== 'object') return [];
        const candidate = track as Record<string, unknown>;
        if (typeof candidate.url !== 'string' || !candidate.url) return [];
        return [{
          label: typeof candidate.lang === 'string' ? candidate.lang : 'Subtitles',
          url: candidate.url,
        }];
      })
    : [];
  const expiresAt = typeof raw.expiresAt === 'number' ? raw.expiresAt : Date.now() + 60_000;
  const source = typeof raw.source === 'string' ? raw.source : `Source ${index + 1}`;
  return {
    id: typeof raw.id === 'string' ? raw.id : `${source}-${index}`,
    name: `Cineverse ${index + 1}`,
    url,
    headers,
    quality: typeof raw.quality === 'string' ? raw.quality : 'Auto',
    subtitles,
    source: `Cineverse ${index + 1}`,
    expiresAt,
    contentType: raw.contentType === 'hls' || raw.contentType === 'dash' || raw.contentType === 'progressive'
      ? raw.contentType
      : contentTypeOf(url),
    offline: url.includes('/cineverse-offline/'),
  };
}

export async function fetchPlaybackSources(request: PlaybackRequest, signal?: AbortSignal, onSources?: (sources: PlaybackSource[]) => void): Promise<PlaybackSource[]> {
  const base = scraperBase();
  if (!base) throw new Error('Web playback is not connected yet. Please use the Cineverse Android app for now.');
  if (!valid(request)) return [];
  await assertEpisodeReleased(request);
  const url = new URL(streamPath(request), base);
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/x-ndjson, application/json' },
  });
  if (!response.ok) throw new Error(`Stream service returned ${response.status}.`);
  if (response.headers.get('content-type')?.includes('application/x-ndjson') && response.body) {
    const found: PlaybackSource[] = [];
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '', failures = 0;
    const line = (text: string) => {
      if (!text.trim()) return;
      const data = JSON.parse(text) as { type: string; stream?: Record<string, unknown>; failed?: number };
      if (data.type === 'done') failures = data.failed ?? 0;
      if (data.type === 'error') failures++;
      if (data.type !== 'source' || !data.stream) return;
      const stream = normalize(data.stream, found.length);
      if (stream && stream.expiresAt > Date.now() && !found.some(item => item.url === stream.url)) {
        found.push(stream); onSources?.([...found]);
      }
    };
    try {
      while (true) {
        const chunk = await reader.read();
        pending += decoder.decode(chunk.value, { stream: !chunk.done });
        const lines = pending.split('\n'); pending = lines.pop() ?? '';
        lines.forEach(line);
        if (chunk.done) { line(pending); break; }
      }
    } catch (error) {
      if (signal?.aborted || !found.length) throw error;
      // A late provider connection failure must not discard a source already playing.
    } finally { reader.releaseLock(); }
    if (!found.length && failures) throw new Error('Playback providers could not be reached. Please try again.');
    return found;
  }
  const data = await response.json() as { streams?: unknown };
  if (!Array.isArray(data.streams)) return [];
  return data.streams
    .flatMap((item, index): PlaybackSource[] => {
      if (!item || typeof item !== 'object') return [];
      const source = normalize(item as Record<string, unknown>, index);
      return source ? [source] : [];
    })
    .filter((source) => source.expiresAt > Date.now())
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
}
