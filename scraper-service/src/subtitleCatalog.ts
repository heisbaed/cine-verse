import { signMediaUrl } from './signing';
import type { Env } from './types';

export async function subtitleCatalog(request: Request, env: Env, kind: string, id: string) {
  const pattern = kind === 'movie' ? /^tt\d{5,12}$/ : /^tt\d{5,12}:\d{1,4}:\d{1,5}$/;
  if (!['movie', 'series'].includes(kind) || !pattern.test(id)) {
    return Response.json({ error: 'Invalid subtitle lookup' }, { status: 400 });
  }
  const [, season, episode] = id.split(':');
  try {
    const response = await fetch(`https://opensubtitles-v3.strem.io/subtitles/${kind}/${id}.json`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    });
    if (!response.ok) throw new Error('Subtitle lookup failed');
    const data = await response.json<{ subtitles: Record<string, unknown>[] }>();
    const counts = new Map<string, number>();
    const seen = new Set<string>();
    const tracks = [];
    for (const row of data.subtitles) {
      if (typeof row.url !== 'string' || !/^https:\/\/subs\d*\.strem\.io\//i.test(row.url) || seen.has(row.url)) continue;
      if (season && ((row.season != null && Number(row.season) !== Number(season)) ||
          (row.episode != null && Number(row.episode) !== Number(episode)))) continue;
      const lang = typeof row.lang === 'string' ? row.lang : 'und';
      const version = (counts.get(lang) ?? 0) + 1;
      if (version > 3) continue;
      counts.set(lang, version);
      seen.add(row.url);
      tracks.push({ lang, version, url: row.url });
    }
    const origin = new URL(request.url).origin;
    return Response.json(await Promise.all(tracks.map(async track => ({
      ...track, url: await signMediaUrl(track.url, {}, env, origin, true),
    }))), { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Subtitle catalog unavailable' }, { status: 503 });
  }
}
