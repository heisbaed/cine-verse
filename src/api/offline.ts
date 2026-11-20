import type { OfflineItem, PlaybackRequest, PlaybackSource } from '@/types/playback';

const CACHE_NAME = 'cineverse-offline-media-v1';
const STORAGE_KEY = 'cineverse-offline-library-v1';
const UPDATE_EVENT = 'cineverse-offline-updated';
const OFFLINE_PREFIX = '/cineverse-offline/';
const controllers = new Map<string, AbortController>();

const isBrowser = () => typeof window !== 'undefined';

function offlineFileUrl(id: string, file: string): string {
  return `${window.location.origin}${OFFLINE_PREFIX}${encodeURIComponent(id)}/${encodeURIComponent(file)}`;
}

function readLibrary(): OfflineItem[] {
  if (!isBrowser()) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed as OfflineItem[] : [];
  } catch {
    return [];
  }
}

function writeLibrary(items: OfflineItem[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent<OfflineItem[]>(UPDATE_EVENT, { detail: items }));
}

export function listOfflineItems(): OfflineItem[] {
  return readLibrary().sort((a, b) => b.createdAt - a.createdAt);
}

export function getOfflineItem(id: string): OfflineItem | null {
  return readLibrary().find((item) => item.id === id) ?? null;
}

function upsert(item: OfflineItem): void {
  const items = readLibrary();
  const index = items.findIndex((candidate) => candidate.id === item.id);
  if (index >= 0) items[index] = item;
  else items.unshift(item);
  writeLibrary(items);
}

export function offlineMediaKey(request: PlaybackRequest, source: PlaybackSource): string {
  const base = request.kind === 'movie'
    ? `movie-${request.tmdbId}`
    : `tv-${request.tmdbId}-s${request.season}-e${request.episode}`;
  return `${base}-${source.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function guessContentType(url: string): string {
  if (/\.m3u8(?:$|[?#])/i.test(url)) return 'application/vnd.apple.mpegurl; charset=utf-8';
  if (/\.mp4(?:$|[?#])/i.test(url)) return 'video/mp4';
  if (/\.(ts|m4s|mp4|webm|vtt|key|bin)(?:$|[?#])/i.test(url)) {
    const ext = new URL(url, window.location.origin).pathname.split('.').pop()?.toLowerCase();
    if (ext === 'ts') return 'video/mp2t';
    if (ext === 'm4s') return 'video/iso.segment';
    if (ext === 'vtt') return 'text/vtt';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'key' || ext === 'bin') return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

function extensionOf(url: string): string {
  const path = new URL(url, window.location.origin).pathname;
  const match = path.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0] : '';
}

function absoluteUrl(value: string, base: string): string {
  if (/^(data:|blob:)/i.test(value)) return value;
  return new URL(value, base).toString();
}

type ProgressState = {
  bytes: number;
  files: Set<string>;
  lastPublish: number;
};

async function fetchResource(
  url: string,
  id: string,
  file: string,
  cache: Cache,
  signal: AbortSignal,
  progress: ProgressState,
): Promise<{ local: string; text: string | null; bytes: number }> {
  const response = await fetch(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`Download failed for ${file} (${response.status}).`);
  const buffer = await response.arrayBuffer();
  const local = offlineFileUrl(id, file);
  const upstreamType = response.headers.get('Content-Type');
  const contentType = /\.m3u8$/i.test(file)
    ? 'application/vnd.apple.mpegurl; charset=utf-8'
    : upstreamType && !/text\/html/i.test(upstreamType)
      ? upstreamType
      : guessContentType(url);
  await cache.put(local, new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  }));
  progress.bytes += buffer.byteLength;
  progress.files.add(local);
  return {
    local,
    text: contentType.includes('mpegurl') ? new TextDecoder().decode(buffer) : null,
    bytes: buffer.byteLength,
  };
}

async function runPool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await tasks[index]();
    }
  }));
  return results;
}

function selectPlaylist(master: string, base: string): string | null {
  const lines = master.split(/\r?\n/);
  const variants: Array<{ url: string; width: number; bandwidth: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF:')) continue;
    const uri = lines[index + 1]?.trim();
    if (!uri || uri.startsWith('#')) continue;
    const resolution = lines[index].match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/)?.[1] ?? 0);
    variants.push({
      url: absoluteUrl(uri, base),
      width: Number(resolution?.[2] ?? 0),
      bandwidth,
    });
  }
  if (variants.length === 0) return null;
  variants.sort((a, b) => b.width - a.width || b.bandwidth - a.bandwidth);
  return variants[0].url;
}

type PlaylistTask = {
  kind: 'uri' | 'segment';
  raw: string;
  url: string;
  file: string;
  nested: boolean;
};

async function packagePlaylist(
  url: string,
  id: string,
  fileBase: string,
  cache: Cache,
  signal: AbortSignal,
  progress: ProgressState,
  seen: Map<string, Promise<string>>,
): Promise<{ local: string; text: string }> {
  const playlist = await fetchResource(url, id, `${fileBase}.m3u8`, cache, signal, progress);
  if (playlist.text === null) throw new Error('The stream playlist could not be read.');
  const lines = playlist.text.split(/\r?\n/);
  const tasks: PlaylistTask[] = [];
  let counter = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('#')) {
      for (const match of line.matchAll(/URI="([^"]+)"/g)) {
        const raw = match[1];
        if (/^(data:|blob:)/i.test(raw)) continue;
        counter += 1;
        const nested = /#EXT-X-MEDIA:|#EXT-X-I-FRAME-STREAM-INF:/.test(line);
        tasks.push({
          kind: 'uri',
          raw,
          url: absoluteUrl(raw, url),
          file: nested ? `${fileBase}-media-${counter}.m3u8` : `${fileBase}-asset-${counter}${extensionOf(raw)}`,
          nested,
        });
      }
    } else if (line.trim()) {
      counter += 1;
      tasks.push({
        kind: 'segment',
        raw: line.trim(),
        url: absoluteUrl(line.trim(), url),
        file: `${fileBase}-seg-${counter}${extensionOf(line.trim())}`,
        nested: false,
      });
    }
  }

  const locals = await runPool(tasks.map((task) => async () => {
    const key = `${task.nested ? 'playlist' : 'asset'}:${task.url}`;
    let pending = seen.get(key);
    if (!pending) {
      pending = task.nested
        ? packagePlaylist(task.url, id, task.file.replace(/\.m3u8$/i, ''), cache, signal, progress, seen).then((result) => result.local)
        : fetchResource(task.url, id, task.file, cache, signal, progress).then((result) => result.local);
      seen.set(key, pending);
    }
    return pending;
  }), 6);

  const rewritten = [...lines];

  tasks.forEach((task, index) => {
    const local = locals[index];
    for (let lineIndex = 0; lineIndex < rewritten.length; lineIndex += 1) {
      const line = rewritten[lineIndex];
      if (task.kind === 'uri') {
        if (line.includes(`"${task.raw}"`)) {
          rewritten[lineIndex] = line.replace(`"${task.raw}"`, `"${local}"`);
          break;
        }
      } else if (line.trim() === task.raw) {
        rewritten[lineIndex] = local;
        break;
      }
    }
  });

  const finalText = rewritten.join('\n');
  await cache.put(playlist.local, new Response(finalText, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  }));
  return { local: playlist.local, text: finalText };
}

export type DownloadOptions = {
  request: PlaybackRequest;
  source: PlaybackSource;
  title: string;
  subtitle?: string;
  poster?: string;
};

export async function downloadOfflineSource(options: DownloadOptions): Promise<OfflineItem> {
  if (!isBrowser()) throw new Error('Downloads are available in the browser only.');
  const { request, source, title, subtitle, poster } = options;
  const id = offlineMediaKey(request, source);
  const existing = getOfflineItem(id);
  if (existing?.status === 'ready') return existing;

  controllers.get(id)?.abort();
  const controller = new AbortController();
  controllers.set(id, controller);
  const cache = await caches.open(CACHE_NAME);
  const progress: ProgressState = { bytes: 0, files: new Set(), lastPublish: 0 };
  const createdAt = existing?.createdAt ?? Date.now();
  let item: OfflineItem = {
    id,
    mediaKey: id,
    title,
    subtitle,
    poster,
    url: '',
    contentType: source.contentType === 'hls' ? 'hls' : 'progressive',
    quality: source.quality,
    source: source.name,
    bytes: 0,
    files: [],
    createdAt,
    status: 'downloading',
    progress: 0,
  };
  upsert(item);

  const publish = (force = false) => {
    const now = Date.now();
    if (!force && now - progress.lastPublish < 400) return;
    progress.lastPublish = now;
    item = { ...item, bytes: progress.bytes, files: [...progress.files] };
    upsert(item);
  };

  try {
    await navigator.storage?.persist?.();
    let local: string;
    let contentType: OfflineItem['contentType'];
    const seen = new Map<string, Promise<string>>();

    if (source.contentType === 'hls' || /\.m3u8(?:$|[?#])/i.test(source.url)) {
      const master = await fetchResource(source.url, id, 'master.m3u8', cache, controller.signal, progress);
      publish();
      const selected = master.text ? selectPlaylist(master.text, source.url) : null;
      const packaged = await packagePlaylist(selected ?? source.url, id, 'playlist', cache, controller.signal, progress, seen);
      local = packaged.local;
      contentType = 'hls';
    } else {
      const file = `movie${extensionOf(source.url) || '.mp4'}`;
      const packaged = await fetchResource(source.url, id, file, cache, controller.signal, progress);
      local = packaged.local;
      contentType = 'progressive';
    }

    item = {
      ...item,
      url: local,
      contentType,
      bytes: progress.bytes,
      files: [...progress.files],
      status: 'ready',
      progress: 100,
      error: undefined,
    };
    upsert(item);
    return item;
  } catch (caught) {
    const cancelled = controller.signal.aborted;
    item = {
      ...item,
      status: 'error',
      error: cancelled ? 'Download cancelled.' : caught instanceof Error ? caught.message : 'Download failed.',
      bytes: progress.bytes,
      files: [...progress.files],
    };
    upsert(item);
    throw caught;
  } finally {
    if (controllers.get(id) === controller) controllers.delete(id);
  }
}

export function cancelOfflineDownload(id: string): void {
  controllers.get(id)?.abort();
  controllers.delete(id);
}

export async function deleteOfflineItem(id: string): Promise<void> {
  cancelOfflineDownload(id);
  const item = getOfflineItem(id);
  if (item && 'caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(item.files.map((file) => cache.delete(file).catch(() => false)));
  }
  writeLibrary(readLibrary().filter((candidate) => candidate.id !== id));
}

export async function offlineStorageUsage(): Promise<number> {
  if (!isBrowser() || !navigator.storage?.estimate) return 0;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? 0;
}
