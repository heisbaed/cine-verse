import { loadMediaSession, loadSegmentSet, storeSegmentSet, type MediaSession, type SegmentSet } from './session';
import type { Env } from './types';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
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

async function fetchText(url: string, session: MediaSession): Promise<string> {
  const response = await fetch(url, { headers: session.headers, redirect: 'follow' });
  if (!response.ok) throw new Error(`Playlist returned ${response.status}.`);
  return response.text();
}

async function buildSegmentSet(id: string, session: MediaSession, origin: string): Promise<SegmentSet> {
  let text = await fetchText(session.target, session);
  let base = session.target;
  const variant = selectVariant(text, base);
  if (variant) {
    text = await fetchText(variant, session);
    base = variant;
  }

  const assets: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => {
    if (!line.startsWith('#')) return line;
    if (!/URI="/.test(line)) return line;
    return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
      if (/^(data:|blob:)/i.test(uri)) return `URI="${uri}"`;
      const index = assets.push(resolveUri(uri, base)) - 1;
      return `URI="${origin}/media/${id}/asset/${index}"`;
    });
  });

  const segments = lines
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => resolveUri(line.trim(), base));
  const rewritten = lines.map((line) => {
    if (!line.trim() || line.startsWith('#')) return line;
    const index = segments.indexOf(resolveUri(line.trim(), base));
    return `${origin}/media/${id}/seg/${index}.ts`;
  });

  const data = { base, segments, assets, playlist: rewritten.join('\n') };
  await storeSegmentSet(id, data);
  return data;
}

export async function ensureSegmentSet(id: string, session: MediaSession, origin: string): Promise<SegmentSet> {
  return (await loadSegmentSet(id)) || buildSegmentSet(id, session, origin);
}

async function streamUrl(url: string, session: MediaSession, contentType: string): Promise<Response> {
  const response = await fetch(url, { headers: session.headers, redirect: 'follow' });
  if (!response.ok && response.status !== 206) return errorResponse(502, 'Media provider could not be reached.');
  if (!response.body) return errorResponse(502, 'Media provider returned an empty body.');
  const upstreamType = response.headers.get('Content-Type');
  const finalType = !contentType || /^image\//i.test(contentType)
    ? upstreamType && !/^image\//i.test(upstreamType) ? upstreamType : 'video/mp2t'
    : contentType;
  return new Response(response.body, {
    status: 200,
    headers: { ...CORS, 'Content-Type': finalType, 'Accept-Ranges': 'none', 'Cache-Control': 'no-store' },
  });
}

export async function handleMediaMaster(request: Request, env: Env, id: string): Promise<Response> {
  const session = await loadMediaSession(id);
  if (!session) return errorResponse(403, 'Invalid or expired media session.');
  try {
    const origin = new URL(request.url).origin;
    const data = await ensureSegmentSet(id, session, origin);
    return new Response(data.playlist, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    } catch {
    return errorResponse(502, 'Playlist provider could not be reached.');
  }
}

export async function handleMediaPart(
request: Request, env: Env, id: string, kind: 'seg' | 'asset', indexValue: string): Promise<Response> {
  const session = await loadMediaSession(id);
  if (!session) return errorResponse(403, 'Invalid or expired media session.');
  const index = Number(indexValue.replace(/\.(ts|m4s|mp4)$/i, ''));
  if (!Number.isInteger(index) || index < 0) return errorResponse(400, 'Invalid media part.');
  try {
    const origin = new URL(request.url).origin;
    const data = await ensureSegmentSet(id, session, origin);
    const list = kind === 'seg' ? data.segments : data.assets;
    const url = list[index];
    if (!url) return errorResponse(404, 'Media part not found.');
    return await streamUrl(url, session, kind === 'seg' ? 'video/mp2t' : 'application/octet-stream');
  } catch {
    return errorResponse(502, 'Media provider could not be reached.');
  }
}
