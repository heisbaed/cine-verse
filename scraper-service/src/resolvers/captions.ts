import type { SubtitleTrack } from '../types';

export function readCaptions(payload: unknown, base: string): SubtitleTrack[] {
  if (!payload || typeof payload !== 'object') return [];
  const data = payload as Record<string, unknown>;
  const seen = new Set<string>();
  const tracks: SubtitleTrack[] = [];
  for (const list of [data.subtitles, data.captions, data.tracks]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const { kind, type, url, file, src, lang, language, label } = item as Record<string, unknown>;
      const role = kind ?? type;
      if (typeof role === 'string' && /^(thumbnail|thumbnails|chapter|chapters|audio|metadata)$/i.test(role)) continue;
      const value = url ?? file ?? src;
      if (typeof value !== 'string' || !value) continue;
      try {
        const resolved = new URL(value, base);
        if (resolved.protocol !== 'https:' || seen.has(resolved.href)) continue;
        if (list === data.tracks && !/caption|subtitle/i.test(String(role ?? '')) && !/\.(srt|vtt)$/i.test(resolved.pathname)) continue;
        const name = [label, lang, language].find((name): name is string => typeof name === 'string' && Boolean(name.trim()));
        tracks.push({ url: resolved.href, lang: name ?? 'Subtitles' });
        seen.add(resolved.href);
      } catch { /* A malformed track should not hide a playable source. */ }
    }
  }
  return tracks;
}
