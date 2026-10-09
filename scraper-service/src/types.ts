export type MediaRequest =
  | { kind: 'movie'; tmdbId: number }
  | { kind: 'tv'; tmdbId: number; season: number; episode: number };

export interface SubtitleTrack {
  lang: string;
  url: string;
}

export interface StreamRecord {
  url: string;
  headers: Record<string, string>;
  quality: 'Auto' | '4K' | '1080p' | '720p' | string;
  subtitles: SubtitleTrack[];
  source: string;
  expiresAt: number;
}

export interface Adapter {
  readonly id: string;
  resolve(request: MediaRequest, signal: AbortSignal, env: Env): Promise<StreamRecord[]>;
}

export interface Env {
  SERVICE_VERSION?: string;
  BROKEN_SOURCES?: string;
  UPSTREAM_A_URL?: string;
  UPSTREAM_A_TOKEN?: string;
  TORBOX_TOKEN?: string;
  TMDB_API_KEY?: string;
  LOCAL_SCRAPER_URL?: string;
  RENDER_SCRAPER_URL?: string;
}
