export type PlaybackKind = 'movie' | 'tv';

export interface PlaybackRequest {
  kind: PlaybackKind;
  tmdbId: number;
  season?: number;
  episode?: number;
}

export interface SubtitleSource {
  label: string;
  url: string;
  default?: boolean;
}

export interface PlaybackSource {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  quality: string;
  subtitles: SubtitleSource[];
  source: string;
  expiresAt: number;
  contentType?: 'hls' | 'progressive' | 'dash';
  offline?: boolean;
}

export interface OfflineItem {
  id: string;
  mediaKey: string;
  title: string;
  subtitle?: string;
  poster?: string;
  url: string;
  contentType: 'hls' | 'progressive';
  quality: string;
  source: string;
  bytes: number;
  files: string[];
  createdAt: number;
  status: 'downloading' | 'ready' | 'error';
  progress: number;
  error?: string;
}
