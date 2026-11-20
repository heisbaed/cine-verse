import type { Env } from './types';
import { signMediaUrl, verifyProxyRequest, type ProxyHeaders } from './signing';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

const PASSTHROUGH_HEADERS = ['content-length', 'content-range', 'etag', 'last-modified', 'content-type'];

function isPlaylist(url: string, contentType: string | null): boolean {
  return /mpegurl|m3u/i.test(contentType ?? '') || /\.m3u8(?:$|[?#])/i.test(url);
}

function resolveUri(value: string, base: string): string {
  if (/^(data:|blob:)/i.test(value)) return value;
  return new URL(value, base).toString();
}

async function rewriteUriAttribute(line: string, base: string, sign: (value: string) => Promise<string>): Promise<string> {
  let output = line;
  const matches = [...line.matchAll(/URI="([^"]+)"/g)];
  for (const match of matches) {
    const next = await sign(resolveUri(match[1], base));
    output = output.replace(match[0], `URI="${next}"`);
  }
  return output;
}

async function rewritePlaylist(text: string, base: string, sign: (value: string) => Promise<string>): Promise<string> {
  const lines = text.split(/\r?\n/);
  const rewritten: string[] = [];
  // Overlap signing operations while bounding the number of pending promises.
  for (let offset = 0; offset < lines.length; offset += 24) {
    const batch = lines.slice(offset, offset + 24);
    rewritten.push(...await Promise.all(batch.map((line) => {
      if (line.startsWith('#')) return /URI="/.test(line) ? rewriteUriAttribute(line, base, sign) : line;
      return line.trim() ? sign(resolveUri(line.trim(), base)) : line;
    })));
  }
  return rewritten.join('\n');
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export async function handleProxyRequest(request: Request, env: Env): Promise<Response> {
  const incoming = new URL(request.url);
  const signed = await verifyProxyRequest(incoming, env);
  if (!signed) return errorResponse(403, 'Invalid or expired media token.');
  if (request.method !== 'GET' && request.method !== 'HEAD') return errorResponse(405, 'Method not allowed.');

  const proxyBase = incoming.origin;
  const sign = (value: string) => signMediaUrl(value, signed.headers as ProxyHeaders, env, proxyBase);
  const proxyHeaders: Record<string, string> = { ...signed.headers };

  const range = request.headers.get('Range');
  if (range) proxyHeaders.Range = range;
  try {
    const playlistHint = /\.m3u8(?:$|[?#])/i.test(signed.target);
    const upstream = await fetch(signed.target, {
      method: request.method,
      headers: proxyHeaders,
      redirect: 'follow',
      ...(playlistHint ? { signal: AbortSignal.timeout(30_000) } : {}),
    });
    if (!upstream.ok) {
      return errorResponse(upstream.status === 404 ? 404 : 502, `Media provider returned ${upstream.status}.`);
    }

    const contentType = upstream.headers.get('Content-Type');
    const playlist = isPlaylist(signed.target, contentType);
    const caption = signed.caption || /\.srt(?:$|[?#])/i.test(signed.target) || /application\/(?:x-)?subrip/i.test(contentType ?? '');
    let body: BodyInit | null = upstream.body;
    if (request.method === 'HEAD') body = null;
    else if (playlist) {
      body = await rewritePlaylist(await upstream.text(), upstream.url || signed.target, sign);
    } else if (caption) {
      const text = (await upstream.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      if (/^WEBVTT(?:\s|$)/.test(text)) body = text;
      else if (/^\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->/m.test(text)) {
        body = `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
      } else return errorResponse(422, 'Unsupported subtitle format.');
    }

    const headers: Record<string, string> = { ...CORS_HEADERS };
    for (const name of PASSTHROUGH_HEADERS) {
      if ((playlist || caption) && name === 'content-length') continue;
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    if (request.method !== 'HEAD' && playlist) {
      headers['Content-Type'] = 'application/vnd.apple.mpegurl; charset=utf-8';
    } else if (caption) {
      headers['Content-Type'] = 'text/vtt; charset=utf-8';
    } else if (!playlist && (!contentType || /^image\//i.test(contentType))) {
      headers['Content-Type'] = 'video/mp2t';
    }
    headers['Accept-Ranges'] = upstream.headers.get('Accept-Ranges') || (playlist ? 'none' : 'bytes');
    headers['Cache-Control'] = 'public, max-age=300';

    return new Response(body, { status: upstream.status, headers });
  } catch {
    return errorResponse(502, 'Media provider could not be reached.');
  }
}
