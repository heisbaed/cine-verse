import { ensureSegmentSet } from './media';
import { loadMediaSession, type MediaSession } from './session';
import { verifyProxyRequest, type ProxyHeaders } from './signing';
import type { Env } from './types';

function safeName(value: string | null): string {
  const cleaned = (value || 'cineverse-download')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  return cleaned || 'cineverse-download';
}

function withExtension(name: string, extension: string): string {
  return /\.[a-zA-Z0-9]{1,6}$/.test(name) ? name : `${name}${extension}`;
}

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function isPlaylistUrl(url: string): boolean {
  const parsed = new URL(url);
  return /\.m3u8(?:$|[?#])/i.test(parsed.pathname + parsed.search) || /\/playlist(?:\/|$|[?#])/i.test(parsed.pathname + parsed.search);
}

function resolveUri(value: string, base: string): string {
  if (/^(data:|blob:)/i.test(value)) return value;
  return new URL(value, base).toString();
}

function selectVariant(playlist: string, base: string): string | null {
  const lines = playlist.split(/\r?\n/);
  const variants: Array<{ url: string; width: number; bandwidth: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF:')) continue;
    const uri = lines[index + 1]?.trim();
    if (!uri || uri.startsWith('#')) continue;
    variants.push({
      url: resolveUri(uri, base),
      width: Number(lines[index].match(/RESOLUTION=\d+x(\d+)/)?.[1] ?? 0),
      bandwidth: Number(lines[index].match(/BANDWIDTH=(\d+)/)?.[1] ?? 0),
    });
  }
  if (variants.length === 0) return null;
  variants.sort((a, b) => b.width - a.width || b.bandwidth - a.bandwidth);
  return variants[0].url;
}

async function pump(reader: ReadableStreamDefaultReader<Uint8Array>, controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    if (value) controller.enqueue(value);
    while ((controller.desiredSize ?? 1) <= 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function streamSegment(url: string, headers: ProxyHeaders, controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
  const response = await fetch(url, { headers, redirect: 'follow' });
  if (!response.ok && response.status !== 206) throw new Error(`Segment returned ${response.status}.`);
  if (!response.body) throw new Error('Segment returned an empty body.');
  await pump(response.body.getReader(), controller);
}

async function streamProgressive(target: string, headers: ProxyHeaders, name: string): Promise<Response> {
  const response = await fetch(target, { headers, redirect: 'follow' });
  if (!response.ok && response.status !== 206) return errorResponse(502, 'Media provider could not be reached.');
  if (!response.body) return errorResponse(502, 'Media provider returned an empty file.');
  return new Response(response.body, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': contentDisposition(name),
    },
  });
}

async function streamHls(target: string, headers: ProxyHeaders, name: string): Promise<Response> {
  const playlistResponse = await fetch(target, { headers, redirect: 'follow' });
  if (!playlistResponse.ok) return errorResponse(502, 'Playlist provider could not be reached.');
  let text = await playlistResponse.text();
  let base = target;
  const variant = selectVariant(text, base);
  if (variant) {
    const variantResponse = await fetch(variant, { headers, redirect: 'follow' });
    if (!variantResponse.ok) return errorResponse(502, 'Variant playlist could not be reached.');
    text = await variantResponse.text();
    base = variant;
  }

  const encrypted = text.split(/\r?\n/).some((line) => line.startsWith('#EXT-X-KEY:') && /METHOD=AES-128/i.test(line));
  if (encrypted) return errorResponse(422, 'This source is encrypted and cannot be saved as a plain video file.');

  const initUri = text.match(/#EXT-X-MAP:[^\n]*URI="([^"]+)"/)?.[1]
    ?? text.match(/#EXT-X-MAP:[^\n]*URI=([^,\s]+)/)?.[1];
  const segments = text.split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => resolveUri(line.trim(), base));
  if (segments.length === 0) return errorResponse(422, 'The stream has no downloadable segments.');

  const fragmented = Boolean(initUri) || segments.some((segment) => /\.m4s(?:$|[?#])/i.test(segment));
  const filename = withExtension(name, fragmented ? '.mp4' : '.ts');
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (initUri) await streamSegment(resolveUri(initUri, base), headers, controller);
        for (const segment of segments) await streamSegment(segment, headers, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': fragmented ? 'video/mp4' : 'video/mp2t',
      'Content-Disposition': contentDisposition(filename),
    },
  });
}

async function streamHlsSession(id: string, session: MediaSession, name: string, origin: string): Promise<Response> {
  const data = await ensureSegmentSet(id, session, origin);
  if (data.segments.length === 0) return errorResponse(422, 'The stream has no downloadable segments.');
  const filename = withExtension(name, '.ts');
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const segment of data.segments) await streamSegment(segment, session.headers, controller);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'video/mp2t',
      'Content-Disposition': contentDisposition(filename),
    },
  });
}

export async function handleDownloadRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405, 'Method not allowed.');
  const incoming = new URL(request.url);
  const name = safeName(incoming.searchParams.get('name'));
  const sessionId = incoming.searchParams.get('sid');
  if (sessionId) {
    const session = await loadMediaSession(sessionId);
    if (!session) return errorResponse(403, 'Invalid or expired media session.');
    try {
      return await streamHlsSession(sessionId, session, name, incoming.origin);
    } catch {
      return errorResponse(502, 'Media provider could not be reached.');
    }
  }
  const signed = await verifyProxyRequest(incoming, env);
  if (!signed) return errorResponse(403, 'Invalid or expired media token.');
  try {
    return isPlaylistUrl(signed.target)
      ? await streamHls(signed.target, signed.headers, name)
      : await streamProgressive(signed.target, signed.headers, name);
  } catch {
    return errorResponse(502, 'Media provider could not be reached.');
  }
}
