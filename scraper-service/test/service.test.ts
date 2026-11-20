import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';
import { signMediaUrl } from '../src/signing';

afterEach(() => vi.unstubAllGlobals());

describe('scraper-service contract', () => {
  it('forwards real Core audio metadata and excluded provider IDs', async () => {
    const stream = { url: 'https://media.example/en.m3u8', source: 'castle', language: 'en', type: 'hls', quality: '1080P', headers: { Referer: 'https://origin.example' }, subtitles: [], expiresAt: Date.now() + 60000 };
    const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ streams: [stream] })));
    vi.stubGlobal('fetch', mock);
    const response = await app.request('/stream/tv/1399/1/1?exclude=frenchstream', {}, { RENDER_SCRAPER_URL: 'https://core.example' });
    expect(await response.json()).toEqual({ streams: [stream] });
    expect(String(mock.mock.calls[0]?.[0])).toBe('https://core.example/stream/tv/1399/1/1?exclude=frenchstream');
  });
  it('reports an unconfigured provider honestly', async () => {
    const response = await app.request('/version', {}, { SERVICE_VERSION: 'test' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      serviceVersion: 'test', adapters: { A: 'unconfigured' }, broken_sources: [],
    });
  });

  it('does not label public test clips as streams for catalog titles', async () => {
    const response = await app.request('/stream/movie/550', {}, { SERVICE_VERSION: 'test' });
    const body = await response.json() as { streams: Array<{ url: string }> };
    expect(body.streams).toEqual([]);
  });

  it('reports a provider as configured only when an endpoint is supplied', async () => {
    const response = await app.request('/version', {}, {
      SERVICE_VERSION: 'test', UPSTREAM_A_URL: 'https://provider.example/api',
    });
    await expect(response.json()).resolves.toMatchObject({ adapters: { A: 'configured' } });
  });

  it('passes through a configured provider direct HTTPS stream', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({
      url: 'https://media.provider.example/movie.mp4', quality: '1080p',
      headers: { Referer: 'https://provider.example', 'X-Internal': 'discard' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await app.request('/stream/movie/550', {}, {
      SERVICE_VERSION: 'test', UPSTREAM_A_URL: 'https://provider.example/api/', UPSTREAM_A_TOKEN: 'test-token',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ streams: [{
      url: 'https://media.provider.example/movie.mp4', source: 'A', quality: '1080p',
      headers: { Referer: 'https://provider.example' },
    }] });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://provider.example/movie/550');
  });

  it('proxies signed HLS playlists and rewrites nested media URLs', async () => {
    const env = { SERVICE_VERSION: 'test', PROXY_SECRET: 'test-secret' };
    const target = 'https://media.example/hls/master.m3u8';
    const signed = await signMediaUrl(target, { Referer: 'https://origin.example' }, env, 'https://worker.example');
    const signedUrl = new URL(signed);
    const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(
      '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment1.ts\n',
      { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } },
    ));
    vi.stubGlobal('fetch', mock);

    const response = await app.request(`${signedUrl.pathname}${signedUrl.search}`, {}, env);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(String(mock.mock.calls[0]?.[0])).toBe(target);
    expect(body).toContain('URI="http://localhost/proxy?');
    expect(body).toContain('\nhttp://localhost/proxy?');
    expect(body).not.toContain('\nsegment1.ts');
  });

  it('streams signed downloads to the browser downloader with an attachment header', async () => {
    const env = { SERVICE_VERSION: 'test', PROXY_SECRET: 'test-secret' };
    const target = 'https://media.example/hls/video.m3u8';
    const signed = new URL(await signMediaUrl(target, { Referer: 'https://origin.example' }, env, 'https://worker.example'));
    signed.pathname = '/download';
    signed.searchParams.set('name', 'Fight Club.ts');
    const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input) => {
      const url = String(input);
      if (url === target) return new Response('#EXTM3U\nsegment1.ts\n');
      if (url === 'https://media.example/hls/segment1.ts') return new Response('video-bytes');
      throw new Error(`Unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', mock);

    const response = await app.request(`${signed.pathname}${signed.search}`, {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="Fight Club.ts"');
    expect(response.headers.get('Content-Type')).toBe('video/mp2t');
    await expect(response.text()).resolves.toBe('video-bytes');
  });

  it('rejects unsigned proxy requests', async () => {
    const response = await app.request('/proxy?u=https%3A%2F%2Fmedia.example%2Fmovie.mp4', {}, { PROXY_SECRET: 'test-secret' });
    expect(response.status).toBe(403);
  });

  it('validates path parameters', async () => {
    expect((await app.request('/stream/tv/no/1/1')).status).toBe(400);
    expect((await app.request('/stream/tv/1/0/1')).status).toBe(400);
  });
});
