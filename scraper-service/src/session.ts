import type { ProxyHeaders } from './signing';
import type { Env } from './types';

const CACHE_NAME = 'cineverse-media-sessions-v1';
const SESSION_TTL = 6 * 60 * 60;

export type MediaSession = {
  exp: number;
  target: string;
  headers: ProxyHeaders;
};

export type SegmentSet = {
  base: string;
  segments: string[];
  assets: string[];
  playlist: string;
};

function cachesAvailable(): boolean {
  return typeof caches !== 'undefined';
}

function sessionKey(id: string): string {
  return `https://cineverse-session.local/${id}.json`;
}

function dataKey(id: string, suffix: string): string {
  return `https://cineverse-session.local/${id}/${suffix}.json`;
}

export function isValidSessionId(id: string): boolean {
  return /^[a-f0-9]{32}$/.test(id);
}

export async function createMediaSession(target: string, headers: ProxyHeaders, env: Env, proxyBase: string): Promise<string | null> {
  if (!env.PROXY_SECRET || !cachesAvailable()) return null;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const session: MediaSession = { exp: Math.floor(Date.now() / 1000) + SESSION_TTL, target, headers };
  const cache = await caches.open(CACHE_NAME);
  await cache.put(sessionKey(id), new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${SESSION_TTL}` },
  }));
  const playlist = /\.m3u8(?:$|[?#])/i.test(target) || /\/playlist(?:\/|$|[?#])/i.test(target);
  const extension = playlist ? '/master.m3u8' : '/file';
  return `${new URL(proxyBase).origin}/media/${id}${extension}`;
}

export async function loadMediaSession(id: string): Promise<MediaSession | null> {
  if (!isValidSessionId(id) || !cachesAvailable()) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(sessionKey(id));
  if (!response) return null;
  try {
    const session = await response.json() as MediaSession;
    if (!Number.isFinite(session.exp) || session.exp < Math.floor(Date.now() / 1000)) return null;
    if (!session.target || typeof session.headers !== 'object') return null;
    return session;
  } catch {
    return null;
  }
}

export async function storeSegmentSet(id: string, data: SegmentSet): Promise<void> {
  if (!cachesAvailable()) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(dataKey(id, 'segments'), new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${SESSION_TTL}` },
  }));
}

export async function loadSegmentSet(id: string): Promise<SegmentSet | null> {
  if (!isValidSessionId(id) || !cachesAvailable()) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(dataKey(id, 'segments'));
  if (!response) return null;
  try {
    const data = await response.json() as SegmentSet;
    if (!Array.isArray(data.segments) || !Array.isArray(data.assets) || typeof data.playlist !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}
