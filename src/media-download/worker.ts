/// <reference lib="webworker" />
import {
  AppendOnlyStreamTarget, BufferSource, Conversion, CustomPathedSource, HLS_FORMATS,
  Input, Mp4OutputFormat, Output, UrlSource,
} from 'mediabunny';

const worker = self as unknown as ServiceWorkerGlobalScope;
type Job = { ticket: string; url: string; audioUrl?: string; name: string; hls: boolean };
type Prepared = { start(keepAlive: (promise: Promise<void>) => void): Response; dispose(): void };
const pending = new Map<string, () => Prepared>();
const jobCache = 'cineverse-download-tickets-v1';
const ticketLifetime = 6 * 60 * 60 * 1000;

async function remember(job: Job) {
  const cache = await caches.open(jobCache);
  const now = Date.now();
  for (const key of await cache.keys()) {
    const record = await cache.match(key);
    if (Number(record?.headers.get('expires-at')) <= now) await cache.delete(key);
  }
  await cache.put(worker.registration.scope + job.ticket, Response.json(job, {
    headers: { 'expires-at': String(now + ticketLifetime) },
  }));
}

async function recall(url: string): Promise<Job | null> {
  const cache = await caches.open(jobCache);
  const record = await cache.match(url);
  if (!record) return null;
  if (Number(record.headers.get('expires-at')) <= Date.now()) {
    await cache.delete(url);
    return null;
  }
  return record.json();
}

function attachment(name: string, mime: string) {
  const safe = name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '-').slice(0, 150);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  return new Headers({
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/'/g, '%27')}`,
    'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  });
}

async function prepare(job: Job, signal: AbortSignal): Promise<Prepared> {
  const origin = new URL(job.url).origin;
  const validUrl = (value: string) => {
    const url = new URL(value);
    if (url.origin !== origin || (url.protocol !== 'https:' && url.origin !== worker.location.origin)) {
      throw new Error('Invalid media address.');
    }
    return url.href;
  };
  validUrl(job.url);

  if (!job.hls) {
    const res = await fetch(job.url, { signal, credentials: 'omit' });
    if (!res.ok || !res.body) throw new Error('The video file could not be opened.');
    const type = res.headers.get('Content-Type')?.split(';')[0] || 'application/octet-stream';
    const ext = new URL(job.url).pathname.match(/\.(mp4|webm|mkv|m4v|mov)$/i)?.[0] ?? '.mp4';
    const headers = attachment(job.name + ext, type);
    if (res.headers.has('Content-Length') && !res.headers.has('Content-Encoding')) headers.set('Content-Length', res.headers.get('Content-Length')!);
    return { start: () => new Response(res.body, { headers }), dispose: () => { void res.body?.cancel().catch(() => {}); } };
  }

  const options = {
    requestInit: { credentials: 'omit' as const, cache: 'no-store' as const },
    parallelism: 1, maxCacheSize: 4 * 1024 * 1024,
    getRetryDelay: (attempt: number) => attempt < 3 ? 2 ** attempt : null,
  };
  // Segment envelopes may carry an image prefix before the first MPEG-TS packet.
  // Keep large byte-range media seekable and cap the temporary segment buffer.
  const readPart = async (path: string) => {
    const url = validUrl(path);
    const res = await fetch(url, { signal: transfer.signal, credentials: 'omit', cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error('A media segment could not be read.');
    const limit = 16 * 1024 * 1024;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (size <= limit && Number(res.headers.get('content-length')) <= limit) {
        const chunk = await reader.read();
        if (chunk.done) {
          const bytes = new Uint8Array(size);
          let pos = 0;
          for (const part of chunks) { bytes.set(part, pos); pos += part.length; }
          if (bytes[0] === 0x89 && bytes[1] === 0x50 || bytes[0] === 0xff && bytes[1] === 0xd8 || bytes[0] === 0x47 && bytes[1] === 0x49) {
            for (let i = 0; i + 376 < size; i++) {
              if (bytes[i] === 0x47 && bytes[i + 188] === 0x47 && bytes[i + 376] === 0x47) return new BufferSource(bytes.subarray(i));
            }
          }
          return new BufferSource(bytes);
        }
        chunks.push(chunk.value);
        size += chunk.value.byteLength;
      }
      await reader.cancel();
      return new UrlSource(url, options);
    } finally { reader.releaseLock(); }
  };
  const transfer = new AbortController();
  const loadPart = async (path: string) => {
    for (let attempt = 0; ; attempt++) {
      try { return await readPart(path); }
      catch (error) {
        if (attempt >= 3 || transfer.signal.aborted) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  };
  const root = job.audioUrl ? [
    '#EXTM3U', '#EXT-X-VERSION:4',
    `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Audio",DEFAULT=YES,AUTOSELECT=YES,URI="${validUrl(job.audioUrl)}"`,
    '#EXT-X-STREAM-INF:BANDWIDTH=1000000,AUDIO="audio"', job.url, '',
  ].join('\n') : null;
  const rootPath = root ? new URL("cineverse-selected.m3u8", job.url).href : job.url;
  const source = new CustomPathedSource(rootPath, ({ path, isRoot }) =>
    isRoot && root ? new BufferSource(new TextEncoder().encode(root)) : loadPart(path));
  const input = new Input({ source, formats: HLS_FORMATS });
  const dispose = () => { transfer.abort(); input.dispose(); };
  signal.addEventListener('abort', dispose, { once: true });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video || await video.isLive()) throw new Error('This source has no finished video file.');
    const pipe = new TransformStream<Uint8Array, Uint8Array>();
    const writer = pipe.writable.getWriter();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 2 }),
      target: new AppendOnlyStreamTarget(new WritableStream({ write: chunk => writer.write(chunk) })),
    });
    const conversion = await Conversion.init({ input, output, tracks: 'primary', copy: { mode: 'forced', shiftTolerance: Infinity } });
    if (!conversion.isValid || conversion.discardedTracks.length || (job.audioUrl && !await input.getPrimaryAudioTrack())) {
      throw new Error('This quality cannot be saved with its original audio. Try another source.');
    }
    void writer.closed.catch(dispose);
    return {
      dispose,
      start(keepAlive) {
        keepAlive(conversion.execute().then(() => writer.close()).catch(error => writer.abort(error)).finally(dispose));
        return new Response(pipe.readable, { headers: attachment(job.name + '.mp4', 'video/mp4') });
      },
    };
  } catch (error) { dispose(); throw error; }
}

worker.addEventListener('message', event => {
  const port = event.ports[0];
  if (event.origin !== worker.location.origin || !port) return;
  const job = event.data as Job;
  if (!job || !/^[\da-f-]{36}$/i.test(job.ticket)) return;
  event.waitUntil((async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65_000);
    try {
      const file = await prepare(job, controller.signal);
      clearTimeout(timeout);
      try { await remember(job); } catch (error) { file.dispose(); throw error; }
      // Reuse the prepared stream on first access. Later requests can rebuild it from the saved job.
      await new Promise<void>(resolve => {
        const expires = setTimeout(() => { pending.delete(job.ticket); file.dispose(); resolve(); }, 30_000);
        pending.set(job.ticket, () => {
          clearTimeout(expires); pending.delete(job.ticket); resolve();
          return file;
        });
        port.postMessage({ ready: true });
      });
    } catch (error) {
      port.postMessage({ error: error instanceof Error ? error.message : 'The video could not be prepared.' });
    } finally { clearTimeout(timeout); port.close(); }
  })());
});

worker.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(worker.registration.scope)) return;
  const id = event.request.url.slice(worker.registration.scope.length);
  if (!/^[\da-f-]{36}$/i.test(id)) return;
  // The download manager can request the same URL again after a network interruption.
  // A regenerated MP4 starts at byte zero, so return 200 even when Chrome sends Range.
  let finish!: () => void;
  event.waitUntil(new Promise<void>(resolve => { finish = resolve; }));
  event.respondWith((async () => {
    let streaming = false;
    try {
      let file = pending.get(id)?.();
      if (!file) {
        const job = await recall(event.request.url);
        if (!job) return new Response('Download expired. Select the quality again.', { status: 410 });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 65_000);
        try { file = await prepare(job, controller.signal); } finally { clearTimeout(timeout); }
      }
      const response = file.start(done => {
        streaming = true;
        void done.then(finish, finish);
      });
      response.headers.set('Accept-Ranges', 'none');
      return response;
    } catch {
      return new Response('The video source is temporarily unavailable.', { status: 503 });
    } finally { if (!streaming) finish(); }
  })());
});
