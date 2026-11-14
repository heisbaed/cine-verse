import type { MediaItem, MediaType } from './tmdb';

export type CineMateMood =
  | 'idle'
  | 'watching'
  | 'curious'
  | 'happy'
  | 'thinking'
  | 'excited'
  | 'sleepy'
  | 'shy'
  | 'proud'
  | 'reading'
  | 'loading'
  | 'sad'
  | 'surprised'
  | 'focused';

export const MOOD_LABELS: Record<CineMateMood, string> = {
  idle: 'Idle',
  watching: 'Watching',
  curious: 'Curious',
  happy: 'Happy',
  thinking: 'Thinking',
  excited: 'Excited',
  sleepy: 'Sleepy',
  shy: 'Shy',
  proud: 'Proud',
  reading: 'Reading',
  loading: 'Loading',
  sad: 'Sad',
  surprised: 'Surprised',
  focused: 'Focused',
};

export const MOOD_COLORS: Record<CineMateMood, string> = {
  idle: '#7fd8ff',
  watching: '#34e0a1',
  curious: '#f6d365',
  happy: '#ffcf6b',
  thinking: '#c7a9ff',
  excited: '#ff8fa3',
  sleepy: '#5b6b7f',
  shy: '#9fc0ff',
  proud: '#ff8fa3',
  reading: '#a78bfa',
  loading: '#7fd8ff',
  sad: '#8a96a6',
  surprised: '#ffd166',
  focused: '#34e0a1',
};

export type CineMateAccent = 'gold' | 'ruby' | 'electric' | 'emerald' | 'sky' | 'rose';

export interface CineMatePreferences {
  name: string;
  accent: CineMateAccent;
  voiceEnabled: boolean;
  voiceVolume: number;
  voiceRate: number;
  autoHide: boolean;
  petNameVisible: boolean;
}

export const DEFAULT_PREFERENCES: CineMatePreferences = {
  name: 'there',
  accent: 'electric',
  voiceEnabled: false,
  voiceVolume: 1,
  voiceRate: 1,
  autoHide: false,
  petNameVisible: true,
};

export const ACCENT_VARIANTS: Record<CineMateAccent, string> = {
  gold: '#ffcf6b',
  ruby: '#ff6b8b',
  electric: '#64ffda',
  emerald: '#34e0a1',
  sky: '#7fd8ff',
  rose: '#ff8fa3',
};

export interface CineMateMemory {
  firstSeen: number;
  greetingCount: number;
  totalMessages: number;
  lastMessageAt: number;
  userName?: string;
  favoriteTitleId?: number;
  favoriteMediaType?: MediaType;
  recentTitles: Array<{ kind: 'movie' | 'tv'; id: number; title: string; addedAt: number }>;
  memories: string[];
  milestones: Record<string, number>;
}

export const DEFAULT_MEMORY: CineMateMemory = {
  firstSeen: Date.now(),
  greetingCount: 0,
  totalMessages: 0,
  lastMessageAt: 0,
  recentTitles: [],
  memories: [],
  milestones: {},
};

export interface CineMateMessage {
  id: string;
  from: 'user' | 'cine';
  text: string;
  timestamp: number;
  command?: string;
}

export interface CineMateAnalyticsData {
  activeNow: number;
  sessions: number;
  views: number;
  opens: number;
  searches: number;
  downloads: number;
  firstLaunches: number;
  averageSessionMs: number;
  hasDuration: boolean;
  titles?: Array<{ kind: 'movie' | 'tv'; id: number; visits: number; opens: number }>;
  platforms?: Array<{ name: string; sessions: number }>;
  trendDelta?: string;
  latestView?: MediaItem | null;
  topTitle?: MediaItem | null;
}

export type CineMateMode = 'dashboard' | 'room' | 'gadget' | 'mini';

export interface CineMatePosition {
  x: number;
  y: number;
}

export interface CineMateHeadState {
  eyeOffset: { x: number; y: number };
  eyelids: 'open' | 'closed' | 'half' | 'squint';
  mouth: 'neutral' | 'smile' | 'wide-smile' | 'frown' | 'surprised' | 'oh' | 'zip';
  glow: CineMateMood;
}

export interface BroadcastPoke {
  type: 'poke';
}

export interface BroadcastGreeting {
  type: 'greeting';
  text: string;
}

export interface BroadcastFact {
  type: 'fact';
  text: string;
}

export interface BroadcastTip {
  type: 'tip';
  text: string;
}

export interface BroadcastMood {
  type: 'mood';
  mood: CineMateMood;
}

export interface BroadcastChat {
  type: 'chat';
  text: string;
}
