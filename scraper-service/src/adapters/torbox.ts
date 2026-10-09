import type { Adapter, Env, MediaRequest, StreamRecord } from '../types';

const TORBOX_API = 'https://api.torbox.app/v1/api';
const TMDB_API = 'https://api.themoviedb.org/3';

export const torboxAdapter: Adapter = {
  id: 'torbox',
  async resolve(request: MediaRequest, signal: AbortSignal, env: Env): Promise<StreamRecord[]> {
    const token = env.TORBOX_TOKEN;
    console.log('[TorBox] Token check:', token ? 'present (' + token.length + ' chars)' : 'MISSING');
    if (!token) return [];

    try {
      if (request.kind === 'movie') {
        return await resolveMovie(request.tmdbId, token, env.TMDB_API_KEY, signal);
      } else {
        return await resolveTV(request.tmdbId, request.season, request.episode, token, env.TMDB_API_KEY, signal);
      }
    } catch (error) {
      console.error('[TorBox] Error:', error);
      return [];
    }
  },
};

async function getMovieTitle(tmdbId: number, tmdbKey: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`${TMDB_API}/movie/${tmdbId}?api_key=${tmdbKey}`, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data.title || null;
  } catch {
    return null;
  }
}

async function getTVName(tmdbId: number, tmdbKey: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`${TMDB_API}/tv/${tmdbId}?api_key=${tmdbKey}`, { signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data.name || null;
  } catch {
    return null;
  }
}

async function torboxFetch(path: string, token: string, options: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
  return fetch(`${TORBOX_API}${path}`, {
    ...options,
    signal,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

async function checkCached(hashes: string[], token: string, signal?: AbortSignal): Promise<Map<string, string[]>> {
  const response = await torboxFetch('/torrents/checkcached', token, {
    method: 'POST',
    body: JSON.stringify({ hashes }),
  }, signal);
  
  if (!response.ok) throw new Error(`TorBox checkcached failed: ${response.status}`);
  const data = await response.json();
  return new Map(Object.entries(data.data || {}));
}

async function createTorrent(magnet: string, token: string, signal?: AbortSignal): Promise<string> {
  const response = await torboxFetch('/torrents/createtorrent', token, {
    method: 'POST',
    body: JSON.stringify({ magnet }),
  }, signal);
  
  if (!response.ok) throw new Error(`TorBox createtorrent failed: ${response.status}`);
  const data = await response.json();
  return data.data?.torrent_id;
}

async function selectFiles(torrentId: string, fileIds: string[], token: string, signal?: AbortSignal): Promise<void> {
  const response = await torboxFetch(`/torrents/selectfiles/${torrentId}`, token, {
    method: 'POST',
    body: JSON.stringify({ file_ids: fileIds }),
  }, signal);
  
  if (!response.ok) throw new Error(`TorBox selectfiles failed: ${response.status}`);
}

async function requestDownload(torrentId: string, fileId: string, token: string, signal?: AbortSignal): Promise<string> {
  const response = await torboxFetch('/torrents/requestdl', token, {
    method: 'POST',
    body: JSON.stringify({ torrent_id: torrentId, file_id: fileId }),
  }, signal);
  
  if (!response.ok) throw new Error(`TorBox requestdl failed: ${response.status}`);
  const data = await response.json();
  return data.data?.url;
}

async function searchYTS(title: string): Promise<{ magnet: string; hash: string; quality: string; size: number } | null> {
  try {
    const response = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(title)}&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    const movie = data.data?.movies?.[0];
    if (!movie || !movie.torrents?.length) return null;

    const torrents = movie.torrents
      .filter((t: any) => t.url && t.hash)
      .sort((a: any, b: any) => {
        const qualityOrder = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
        return (qualityOrder[b.quality as keyof typeof qualityOrder] || 0) - (qualityOrder[a.quality as keyof typeof qualityOrder] || 0);
      });

    const best = torrents[0];
    if (!best) return null;

    return {
      magnet: `magnet:?xt=urn:btih:${best.hash}&dn=${encodeURIComponent(movie.title)}`,
      hash: best.hash,
      quality: best.quality,
      size: best.size_bytes || 0,
    };
  } catch {
    return null;
  }
}

async function resolveMovie(tmdbId: number, token: string, tmdbKey: string, signal?: AbortSignal): Promise<StreamRecord[]> {
  const title = await getMovieTitle(tmdbId, tmdbKey, signal);
  if (!title) {
    console.log('[TorBox] Could not get movie title for TMDB ID:', tmdbId);
    return [];
  }

  console.log('[TorBox] Searching YTS for:', title);
  const yts = await searchYTS(title);
  if (!yts) {
    console.log('[TorBox] No YTS results for:', title, '- returning demo streams');
    return [{
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      headers: {},
      quality: '1080p',
      subtitles: [],
      source: 'demo',
      expiresAt: Date.now() + 60 * 60_000,
    }];
  }

  console.log('[TorBox] Found YTS result:', title, yts.quality);

  const cached = await checkCached([yts.hash], token, signal);
  let torrentId: string;
  let fileId: string;

  if (cached.has(yts.hash) && cached.get(yts.hash)?.length) {
    const myTorrents = await torboxFetch('/torrents/mylist', token, { method: 'GET' }, signal);
    const data = await myTorrents.json();
    const torrent = data.data?.find((t: any) => t.hash === yts.hash);
    if (!torrent) return [];
    torrentId = torrent.id;
    
    const file = torrent.files?.find((f: any) => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
    if (!file) return [];
    fileId = file.id;
  } else {
    torrentId = await createTorrent(yts.magnet, token, signal);
    if (!torrentId) return [];

    let cached = false;
    for (let i = 0; i < 30 && !cached; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const check = await checkCached([yts.hash], token, signal);
      if (check.has(yts.hash) && check.get(yts.hash)?.length) {
        cached = true;
      }
    }
    if (!cached) return [];

    const torrentInfo = await torboxFetch(`/torrents/info/${torrentId}`, token, { method: 'GET' }, signal);
    const info = await torrentInfo.json();
    const videoFiles = info.data?.files?.filter((f: any) => f.name.match(/\.(mp4|mkv|m4v|webm)$/i)) || [];
    if (!videoFiles.length) return [];
    
    const fileIds = videoFiles.map((f: any) => f.id);
    await selectFiles(torrentId, fileIds, token, signal);
    fileId = fileIds[0];
  }

  const url = await requestDownload(torrentId, fileId, token, signal);
  if (!url) return [];

  return [{
    url,
    headers: {},
    quality: '1080p',
    subtitles: [],
    source: 'torbox',
    expiresAt: Date.now() + 60 * 60_000,
  }];
}

async function resolveTV(tmdbId: number, season: number, episode: number, token: string, tmdbKey: string, signal?: AbortSignal): Promise<StreamRecord[]> {
  return [];
}