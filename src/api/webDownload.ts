import type { PlaybackSource } from '@/types/playback';

export type FileChoice = {
  id: string;
  url: string;
  quality: string;
  source: PlaybackSource;
  size?: number;
  audioUrl?: string;
};

const attributes = (line: string) => Object.fromEntries(
  [...line.matchAll(/([A-Z-]+)=(?:"([^"]*)"|([^,]+))/g)].map(match => [match[1], match[2] ?? match[3]]),
);

export async function fileChoices(sources: PlaybackSource[], signal: AbortSignal): Promise<FileChoice[]> {
  const groups = await Promise.all(sources.map(async (source): Promise<FileChoice[]> => {
    if (source.contentType === 'dash') return [];
    const base = { id: source.id, url: source.url, quality: source.quality, source };
    if (source.contentType !== 'hls') {
      try {
        const response = await fetch(source.url, { method: 'HEAD', signal });
        const size = Number(response.headers.get('content-length'));
        return [{ ...base, size: response.ok && size > 0 ? size : undefined }];
      } catch { return [base]; }
    }
    const response = await fetch(source.url, { signal });
    if (!response.ok) return [];
    const lines = (await response.text()).split(/\r?\n/).map(line => line.trim());
    if (lines[0] !== '#EXTM3U') return [];
    const audio = lines.filter(line => line.startsWith('#EXT-X-MEDIA:')).map(attributes).filter(row => row.TYPE === 'AUDIO');
    const choices: FileChoice[] = [];
    for (const [i, line] of lines.entries()) {
      if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
      const uri = lines[i + 1];
      if (!uri || uri.startsWith('#')) continue;
      const attrs = attributes(line);
      const group = audio.filter(row => row['GROUP-ID'] === attrs.AUDIO);
      const rendition = group.find(row => row.DEFAULT === 'YES') ?? group[0];
      const height = Number(attrs.RESOLUTION?.split('x')[1]);
      choices.push({
        ...base, id: source.id + '-' + i, quality: height > 0 ? height + 'p' : source.quality,
        url: new URL(uri, response.url).href,
        audioUrl: rendition?.URI ? new URL(rendition.URI, response.url).href : undefined,
      });
    }
    return choices.length ? choices : lines.includes('#EXT-X-ENDLIST') ? [base] : [];
  }));
  return groups.flat();
}
