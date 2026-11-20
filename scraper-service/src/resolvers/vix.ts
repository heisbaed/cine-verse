import type { Env, MediaRequest, StreamRecord, ResolutionObserver } from '../types';

const ORIGIN = 'https://vixsrc.to';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function mediaPath(request: MediaRequest): string {
  return request.kind === 'movie'
    ? `movie/${request.tmdbId}`
    : `tv/${request.tmdbId}/${request.season}/${request.episode}`;
}

export async function resolveVixStreams(request: MediaRequest, _env: Env, _proxyBase: string, signal: AbortSignal, observer: ResolutionObserver = {}): Promise<StreamRecord[]> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  else signal.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let outcome: 'ok' | 'empty' | 'unavailable' = 'unavailable';
  try {
    const path = mediaPath(request);
    const headers = { 'User-Agent': USER_AGENT, Referer: `${ORIGIN}/` };
    const api = await fetch(`${ORIGIN}/api/${path}?lang=en`, { headers, signal: controller.signal });
    if (!api.ok) return [];
    const data = await api.json() as { src?: unknown };
    if (typeof data.src !== 'string') { outcome = 'empty'; return []; }
    const embed = data.src.startsWith('/') && !data.src.startsWith('//') ? `${ORIGIN}${data.src}` : data.src;
    if (!embed.startsWith(`${ORIGIN}/`)) return [];

    const response = await fetch(embed, { headers, signal: controller.signal });
    if (!response.ok) return [];
    const html = await response.text();
    const manifest = html.match(/window\.masterPlaylist\s*=\s*\{([\s\S]*?)\n\s*\}/)?.[1];
    const assignment = html.match(/window\.masterPlaylist\s*=\s*\{([\s\S]*?)\n\s*\};?\s*(?:window\.|<\/script>)/)?.[1] ?? manifest;
    if (!assignment) return [];
    const token = assignment.match(/['"]token['"]\s*:\s*['"]([^'"]+)/)?.[1];
    const expiry = assignment.match(/['"]expires['"]\s*:\s*['"](\d+)/)?.[1];
    const id = html.match(/window\.video\s*=\s*\{\s*id\s*:\s*['"](\d+)/)?.[1];
    if (!token || !expiry || !id) return [];
    const asn = assignment.match(/['"]asn['"]\s*:\s*['"]([^'"]*)/)?.[1];
    const h = html.includes('window.canPlayFHD = true') ? '&h=1' : '';
    const uri = `${ORIGIN}/playlist/${id}?token=${encodeURIComponent(token)}&expires=${expiry}&lang=en${asn ? `&asn=${encodeURIComponent(asn)}` : ''}${h}`;
    const mediaHeaders = { ...headers, Referer: embed };
    outcome = 'ok';
    return [{
      url: uri,
      headers: mediaHeaders,
      quality: 'Auto',
      subtitles: [],
      source: 'VixSrc',
      expiresAt: Number(expiry) * 1000,
      id: 'vixsrc',
      name: 'VixSrc',
      contentType: 'hls',
    }];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', forwardAbort);
    observer.onResult?.(outcome);
  }
}
