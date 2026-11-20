import type { PlaybackSource } from '@/types/playback';

function safeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 140) || 'cineverse-download';
}

function withExtension(value: string, extension: string): string {
  return /\.[a-zA-Z0-9]{1,6}$/.test(value) ? value : `${value}${extension}`;
}

export type BrowserDownloadOptions = {
  source: PlaybackSource;
  title: string;
  subtitle?: string;
};

export function downloadSourceAsFile(options: BrowserDownloadOptions): { filename: string; url: string } {
  const { source, title, subtitle } = options;
  const baseName = safeFilename(subtitle ? `${title} - ${subtitle}` : title);
  const isHls = source.contentType === 'hls' || /\.m3u8(?:$|[?#])/i.test(source.url) || /\/playlist(?:\/|$|[?#])/i.test(source.url);
  const original = new URL(source.url, window.location.href);
  const originalExtension = original.pathname.match(/\.[a-zA-Z0-9]{1,6}$/)?.[0];
  const extension = isHls && (!originalExtension || /\.m3u8$/i.test(originalExtension)) ? '.ts' : originalExtension || (isHls ? '.ts' : '.mp4');
  const filename = withExtension(baseName, extension);
  const url = new URL(source.url, window.location.href);

  if (/\/proxy$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/proxy$/, '/download');
    url.searchParams.set('name', filename);
  } else {
    const sessionId = url.pathname.match(/^\/media\/([a-f0-9]{32})\/master\.m3u8$/)?.[1];
    if (sessionId) {
      url.pathname = '/download';
      url.search = '';
      url.searchParams.set('sid', sessionId);
      url.searchParams.set('name', filename);
    }
  }

  const anchor = document.createElement('a');
  anchor.href = url.toString();
  anchor.download = filename;
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return { filename, url: url.toString() };
}
