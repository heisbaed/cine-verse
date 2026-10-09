import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../src/index';

afterEach(() => vi.unstubAllGlobals());

describe('scraper-service contract', () => {
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

  it('validates path parameters', async () => {
    expect((await app.request('/stream/tv/no/1/1')).status).toBe(400);
    expect((await app.request('/stream/tv/1/0/1')).status).toBe(400);
  });
});
