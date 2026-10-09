import type { Adapter, Env, MediaRequest, StreamRecord } from '../types';

const allowedHeaders = new Set(['Referer', 'Origin', 'User-Agent', 'Cookie']);

/**
 * Adapter boundary for a source the operator is authorized to access.
 * Configure its URL and token as Worker secrets/variables. Provider details stay here,
 * so a weekly source change never requires an APK update.
 */
export const upstreamAAdapter: Adapter = {
  id: 'A',
  async resolve(request: MediaRequest, signal: AbortSignal, env: Env): Promise<StreamRecord[]> {
    if (!env.UPSTREAM_A_URL) return [];
    const path = request.kind === 'movie'
      ? `/movie/${request.tmdbId}`
      : `/tv/${request.tmdbId}/${request.season}/${request.episode}`;
    const response = await fetch(new URL(path, env.UPSTREAM_A_URL), {
      signal,
      headers: env.UPSTREAM_A_TOKEN ? { Authorization: `Bearer ${env.UPSTREAM_A_TOKEN}` } : {},
    });
    if (!response.ok) throw new Error(`Adapter A returned ${response.status}`);
    const payload = await response.json<unknown>();
    const rows = Array.isArray(payload) ? payload : [payload];
    return rows.map(validate).filter((value): value is StreamRecord => value !== null);
  },
};

function validate(value: unknown): StreamRecord | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.url !== 'string' || !input.url.startsWith('https://')) return null;
  const rawHeaders = input.headers && typeof input.headers === 'object' ? input.headers as Record<string, unknown> : {};
  const headers = Object.fromEntries(Object.entries(rawHeaders)
    .filter(([key, item]) => allowedHeaders.has(key) && typeof item === 'string')
    .map(([key, item]) => [key, String(item).slice(0, 500)]));
  return {
    url: input.url,
    headers,
    quality: typeof input.quality === 'string' ? input.quality : 'Auto',
    subtitles: Array.isArray(input.subtitles) ? input.subtitles.filter((item): item is { lang: string; url: string } =>
      Boolean(item && typeof item === 'object' && typeof (item as Record<string, unknown>).lang === 'string' &&
        typeof (item as Record<string, unknown>).url === 'string' && String((item as Record<string, unknown>).url).startsWith('https://'))) : [],
    source: 'A',
    expiresAt: typeof input.expiresAt === 'number' ? input.expiresAt : Date.now() + 30 * 60_000,
  };
}
