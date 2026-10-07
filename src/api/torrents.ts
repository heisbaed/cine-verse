const API_BASE = 'https://movies-api.accel.li/api/v2';

export type TorrentSource = 'YTS' | 'Bay';

export interface TorrentPackage {
  quality: string;
  resolution: string;
  type: string;
  size: string;
  sizeBytes: number;
  seeds: number;
  peers: number;
  torrentUrl: string;
  magnetUrl: string;
  source: TorrentSource;
  releaseName?: string;
}

interface YtsTorrent {
  url: string;
  hash: string;
  quality: string;
  type: string;
  seeds: number;
  peers: number;
  size: string;
  size_bytes: number;
}

interface YtsMovie {
  title_english: string;
  title: string;
  year: number;
  imdb_code: string;
  torrents?: YtsTorrent[];
}

interface YtsListResponse {
  status: string;
  data?: {
    movies?: YtsMovie[];
  };
}

const TRACKERS = [
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:80',
  'udp://tracker.coppersurfer.tk:6969',
  'udp://glotorrents.pw:6969/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.internetwarriors.net:1337',
];

export const buildMagnetUrl = (hash: string, name: string): string => {
  const trackerParams = TRACKERS.map(
    (tracker) => `&tr=${encodeURIComponent(tracker)}`,
  ).join('');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodeURIComponent(name)}${trackerParams}`;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

interface ParsedRelease {
  resolution: string;
  source: string;
}

const parseReleaseName = (name: string): ParsedRelease => {
  const upper = name.toUpperCase();
  let resolution = 'Other';
  if (/4320P|8K/.test(upper)) resolution = '4320p 8K';
  else if (/2160P|4K|UHD/.test(upper)) resolution = '2160p 4K';
  else if (/1080P/.test(upper)) resolution = '1080p';
  else if (/720P/.test(upper)) resolution = '720p';
  else if (/576P|480P/.test(upper)) resolution = '480p';
  else if (/360P/.test(upper)) resolution = '360p';
  else if (/320P/.test(upper)) resolution = '320p';
  else if (/DVDSCR/.test(upper)) resolution = 'DVDSCR';
  else if (/HDTS|TELESYNC|HDCAM|\bCAM\b|\bTS\b/.test(upper)) resolution = 'CAM/TS';

  let source = 'Unknown';
  if (/REMUX/.test(upper)) source = 'REMUX';
  else if (/BLURAY|BLU-RAY|BRRIP|BDRIP/.test(upper)) source = 'BluRay';
  else if (/WEB-DL|WEBDL/.test(upper)) source = 'WEB-DL';
  else if (/WEBRIP|WEB-RIP|WEBRIP/.test(upper)) source = 'WEBRip';
  else if (/WEB\b/.test(upper)) source = 'WEB';
  else if (/HDTV/.test(upper)) source = 'HDTV';
  else if (/DVD/.test(upper)) source = 'DVD';
  else if (/CAM|HDTS|TELESYNC|\bTS\b/.test(upper)) source = 'Cam';
  else if (/XVID|X264|X265|HEVC|H\.?264|H\.?265|AV1/.test(upper)) source = 'Encode';

  return { resolution, source };
};

interface BayEntry {
  id: string;
  name: string;
  info_hash: string;
  leechers: string;
  seeders: string;
  size: string;
  imdb?: string;
  category?: string;
  username?: string;
}

const BAY_TV_CATEGORIES = new Set(['205', '208']);

const BAY_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
];

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

const parseBayPayload = (raw: unknown): BayEntry[] | null => {
  // AllOrigins /get wraps the body as { contents: "<json string>" }.
  if (
    raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    typeof (raw as { contents?: unknown }).contents === 'string'
  ) {
    try {
      const inner = JSON.parse((raw as { contents: string }).contents) as unknown;
      return Array.isArray(inner) ? (inner as BayEntry[]) : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? (raw as BayEntry[]) : null;
};

const fetchBayViaUrl = async (url: string): Promise<BayEntry[]> => {
  const response = await fetchWithTimeout(url, 10000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = (await response.json()) as unknown;
  const entries = parseBayPayload(payload);
  if (!entries) throw new Error('Invalid Bay payload');
  return entries;
};

const fetchBayEntries = async (
  query: string,
): Promise<{ entries: BayEntry[]; reachable: boolean }> => {
  const directUrl = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=200`;
  const attempts = [directUrl, ...BAY_PROXIES.map((proxy) => proxy(directUrl))];
  // Race all attempts in parallel — direct fetch fails on CORS, so the
  // first proxy that answers wins instead of waiting 4 x 12s sequentially.
  const results = await Promise.allSettled(attempts.map((url) => fetchBayViaUrl(url)));
  for (const result of results) {
    if (result.status === 'fulfilled') {
      return { entries: result.value, reachable: true };
    }
  }
  return { entries: [], reachable: false };
};

const getBayPackages = async (options: {
  imdbId?: string | null;
  title: string;
  year?: string;
}): Promise<{ packages: TorrentPackage[]; indexOk: boolean }> => {
  const yearNumber = options.year?.split('-')[0];
  const queries = yearNumber
    ? [`${options.title} ${yearNumber}`, options.title]
    : [options.title];
  const wantedImdb = options.imdbId?.toLowerCase();
  const seen = new Set<string>();
  const packages: TorrentPackage[] = [];
  let indexOk = false;

  for (const query of queries) {
    const { entries, reachable } = await fetchBayEntries(query);
    if (reachable) indexOk = true;
    for (const entry of entries) {
      const hash = entry.info_hash?.toUpperCase() || '';
      if (!hash || /^0+$/.test(hash) || seen.has(hash)) continue;
      if (entry.category && BAY_TV_CATEGORIES.has(entry.category)) continue;
      if (
        wantedImdb &&
        entry.imdb &&
        entry.imdb.toLowerCase() !== wantedImdb
      ) {
        continue;
      }
      seen.add(hash);
      const releaseName = decodeHtml(entry.name || 'Unknown release');
      const parsed = parseReleaseName(releaseName);
      const sizeBytes = Number(entry.size) || 0;
      packages.push({
        quality: `${parsed.resolution} ${parsed.source}`.trim(),
        resolution: parsed.resolution,
        type: parsed.source,
        size: formatBytes(sizeBytes),
        sizeBytes,
        seeds: Number(entry.seeders) || 0,
        peers: Number(entry.leechers) || 0,
        torrentUrl: `https://itorrents.org/torrent/${hash}.torrent`,
        magnetUrl: buildMagnetUrl(hash, releaseName),
        source: 'Bay',
        releaseName,
      });
    }
    if (packages.length > 0) break;
  }

  return { packages, indexOk };
};

const getYtsPackages = async (options: {
  imdbId?: string | null;
  title: string;
  year?: string;
}): Promise<TorrentPackage[]> => {
  const queries: string[] = [];
  if (options.imdbId) queries.push(options.imdbId);
  if (options.year) {
    queries.push(`${options.title} ${options.year.split('-')[0]}`);
  }
  queries.push(options.title);

  for (const query of queries) {
    const response = await fetch(
      `${API_BASE}/list_movies.json?query_term=${encodeURIComponent(query)}&limit=20&sort_by=seeds&order_by=desc`,
    );
    if (!response.ok) continue;
    const payload = (await response.json()) as YtsListResponse;
    const movies = payload.data?.movies || [];
    if (movies.length === 0) continue;

    const wantedTitle = options.title.toLowerCase();
    const wantedYear = options.year?.split('-')[0];
    const matching = movies.filter((item) => {
      if (
        options.imdbId &&
        item.imdb_code?.toLowerCase() === options.imdbId.toLowerCase()
      ) {
        return true;
      }
      const titleMatch =
        item.title_english?.toLowerCase() === wantedTitle ||
        item.title?.toLowerCase() === wantedTitle;
      if (!titleMatch) return false;
      if (wantedYear && item.year) return String(item.year) === wantedYear;
      return true;
    });
    const candidates = matching.length > 0 ? matching : movies.slice(0, 3);

    const seen = new Set<string>();
    const packages: TorrentPackage[] = [];
    for (const movie of candidates) {
      const displayName = `${movie.title_english || movie.title} (${movie.year})`;
      for (const torrent of movie.torrents || []) {
        if (!torrent.hash || seen.has(torrent.hash.toUpperCase())) continue;
        seen.add(torrent.hash.toUpperCase());
        packages.push({
          quality: `${torrent.quality} ${torrent.type}`.trim(),
          resolution: torrent.quality,
          type: torrent.type,
          size: torrent.size,
          sizeBytes: torrent.size_bytes || 0,
          seeds: torrent.seeds,
          peers: torrent.peers,
          torrentUrl: torrent.url,
          magnetUrl: buildMagnetUrl(torrent.hash, displayName),
          source: 'YTS',
          releaseName: `${displayName} ${torrent.quality} ${torrent.type}`,
        });
      }
    }
    if (packages.length > 0) return packages;
  }

  return [];
};

export interface TorrentResult {
  packages: TorrentPackage[];
  bayAvailable: boolean;
}

export const getTorrentPackages = async (options: {
  imdbId?: string | null;
  title: string;
  year?: string;
}): Promise<TorrentResult> => {
  const [yts, bay] = await Promise.all([
    getYtsPackages(options).catch(() => [] as TorrentPackage[]),
    getBayPackages(options).catch(() => ({
      packages: [] as TorrentPackage[],
      indexOk: false,
    })),
  ]);
  const seen = new Set<string>();
  const merged: TorrentPackage[] = [];
  for (const pkg of [...yts, ...bay.packages]) {
    const hash = pkg.magnetUrl.match(/btih:([A-Fa-f0-9]+)/)?.[1]?.toUpperCase();
    if (hash && seen.has(hash)) continue;
    if (hash) seen.add(hash);
    merged.push(pkg);
  }
  return { packages: merged, bayAvailable: bay.indexOk };
};
