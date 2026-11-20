import { readCaptions } from './captions';
import type { Env, MediaRequest, StreamRecord, ResolutionObserver } from '../types';

const CORE = 'https://core.vidzee.wtf';
const PLAYER = 'https://player.vidzee.wtf';
const PLAYBACK_HEADERS = {
  Origin: PLAYER,
  Referer: `${PLAYER}/`,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};
const REQUEST_HEADERS = {
  ...PLAYBACK_HEADERS,
  Accept: 'application/json,text/plain,*/*',
};
const BACKENDS = [
  { id: 'dcloud', name: 'Cineverse 1' },
  { id: 'tik', name: 'Cineverse 2' },
  { id: 'ipcloud', name: 'Cineverse 3' },
] as const;

function endpoint(request: MediaRequest, backend: string): string {
  const path = request.kind === 'movie'
    ? `/streams/movie/${request.tmdbId}`
    : `/streams/tv/${request.tmdbId}/${request.season}/${request.episode}`;
  return `${CORE}${path}?s=${backend}&e=0`;
}

function supportedUri(value: unknown): value is string {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return /\.(m3u8|mp4)(?:$|[?#])/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

async function resolveBackend(
  request: MediaRequest,
  backend: typeof BACKENDS[number],
  _env: Env,
  _proxyBase: string,
  signal: AbortSignal,
  observer: ResolutionObserver,
): Promise<StreamRecord | null> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let outcome: 'ok' | 'empty' | 'unavailable' = 'unavailable';
  try {
    const response = await fetch(endpoint(request, backend.id), {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as { url?: unknown; headers?: Record<string, unknown> };
    if (!supportedUri(data.url)) { outcome = 'empty'; return null; }
    const headers: Record<string, string> = { ...PLAYBACK_HEADERS };
    for (const [key, value] of Object.entries(data.headers ?? {})) {
      if (typeof value !== 'string' || !value.trim() || value.length >= 1000 || /[\r\n]/.test(value)) continue;
      const name = [...Object.keys(PLAYBACK_HEADERS), 'Authorization'].find((field) => field.toLowerCase() === key.toLowerCase());
      if (name) headers[name] = value;
    }
    const contentType = /\.m3u8(?:$|[?#])/i.test(data.url) ? 'hls' : 'progressive';
    outcome = 'ok';
    return {
      url: data.url,
      headers,
      quality: 'Auto',
      subtitles: readCaptions(data, response.url || CORE),
      source: backend.name,
      expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      id: backend.id,
      name: backend.name,
      contentType,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', forwardAbort);
    observer.onResult?.(outcome);
  }
}

export async function resolveVidzeeStreams(request: MediaRequest, env: Env, proxyBase: string, signal: AbortSignal, observer: ResolutionObserver = {}): Promise<StreamRecord[]> {
  const results = await Promise.all(BACKENDS.map(async backend => {
    const stream = await resolveBackend(request, backend, env, proxyBase, signal, observer);
    if (stream) observer.onStream?.(stream);
    return stream;
  }));
  return results.filter((stream): stream is StreamRecord => stream !== null);
}
