import { createMediaSession } from './session';
import type { Env } from './types';

const encoder = new TextEncoder();
const ALLOWED_HEADERS = ['Origin', 'Referer', 'User-Agent', 'Accept', 'Accept-Language'] as const;

export type ProxyHeaders = Record<string, string>;

type SignedPayload = {
  exp: number;
  target: string;
  headers: ProxyHeaders;
  caption?: boolean;
};
const hmacKeys = new Map<string, Promise<CryptoKey>>();

async function hmac(message: string, secret: string): Promise<string> {
  let pending = hmacKeys.get(secret);
  if (!pending) {
    pending = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
    );
    hmacKeys.set(secret, pending);
    if (hmacKeys.size > 4) hmacKeys.delete(hmacKeys.keys().next().value!);
  }
  const key = await pending;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatched = 0;
  for (let index = 0; index < a.length; index += 1) mismatched |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatched === 0;
}

export function sanitizeHeaders(input: Record<string, unknown> | undefined): ProxyHeaders {
  const output: ProxyHeaders = {};
  if (!input) return output;
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/.test(value) || value.length > 1000) continue;
    const name = ALLOWED_HEADERS.find((header) => header.toLowerCase() === key.toLowerCase());
    if (name) output[name] = value;
  }
  return output;
}

function encodeHeaders(headers: ProxyHeaders): string {
  return btoa(JSON.stringify(headers));
}

function decodeHeaders(encoded: string): ProxyHeaders {
  return sanitizeHeaders(JSON.parse(atob(encoded)) as Record<string, unknown>);
}

function payloadOf({ exp, target, headers, caption }: SignedPayload): string {
  return `${exp}.${target}.${encodeHeaders(headers)}${caption ? '.caption' : ''}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function signMediaUrl(
  url: string,
  headers: ProxyHeaders | undefined,
  env: Env,
  proxyBase: string,
  caption = false,
): Promise<string> {
  const cleanHeaders = sanitizeHeaders(headers);
  if (!env.PROXY_SECRET || !isHttpUrl(url) || !isHttpUrl(proxyBase)) return url;
  const parsed = new URL(url);
  if (parsed.pathname === '/proxy' && parsed.searchParams.has('sig')) return url;
  const exp = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  const payload: SignedPayload = { exp, target: url, headers: cleanHeaders, caption };
  const signature = await hmac(payloadOf(payload), env.PROXY_SECRET);
  const proxy = new URL('/proxy', proxyBase);
  proxy.searchParams.set('u', url);
  proxy.searchParams.set('exp', String(exp));
  proxy.searchParams.set('h', encodeHeaders(cleanHeaders));
  if (caption) proxy.searchParams.set('caption', '1');
  proxy.searchParams.set('sig', signature);
  return proxy.toString();
}

export async function signMediaSessionUrl(
  url: string,
  headers: ProxyHeaders | undefined,
  env: Env,
  proxyBase: string,
): Promise<string | null> {
  const playlist = /\.m3u8(?:$|[?#])/i.test(url) || /\/playlist(?:\/|$|[?#])/i.test(url);
  if (!playlist || !isHttpUrl(url) || !isHttpUrl(proxyBase)) return null;
  return createMediaSession(url, sanitizeHeaders(headers), env, proxyBase);
}

export async function verifyProxyRequest(url: URL, env: Env): Promise<SignedPayload | null> {
  if (!env.PROXY_SECRET) return null;
  const exp = Number(url.searchParams.get('exp'));
  const target = url.searchParams.get('u') ?? '';
  const encoded = url.searchParams.get('h') ?? '';
  const signature = url.searchParams.get('sig') ?? '';
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (!isHttpUrl(target) || !signature) return null;
  let headers: ProxyHeaders;
  try {
    headers = decodeHeaders(encoded);
  } catch {
    return null;
  }
  const payload: SignedPayload = { exp, target, headers, caption: url.searchParams.get('caption') === '1' };
  const expected = await hmac(payloadOf(payload), env.PROXY_SECRET);
  return equal(signature, expected) ? payload : null;
}
