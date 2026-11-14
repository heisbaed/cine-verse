import { DEFAULT_MEMORY, DEFAULT_PREFERENCES } from '@/types/cinemate';
import type { CineMateMemory as CineMateMemoryData, CineMateMessage, CineMatePreferences } from '@/types/cinemate';

const MEM_KEY = 'cine-mate-memory-v1';
const PREF_KEY = 'cine-mate-prefs-v1';

const safeLoad = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const safeSave = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Memory works without storage; never crash.
  }
};

export const CineMateMemory = {
  load(): CineMateMemoryData {
    const mem = safeLoad<CineMateMemoryData>(MEM_KEY, DEFAULT_MEMORY);
    return { ...DEFAULT_MEMORY, ...mem };
  },

  save(mem: CineMateMemoryData): void {
    safeSave(MEM_KEY, mem);
  },

  loadPrefs(): CineMatePreferences {
    return safeLoad<CineMatePreferences>(PREF_KEY, DEFAULT_PREFERENCES);
  },

  savePrefs(prefs: CineMatePreferences): void {
    safeSave(PREF_KEY, prefs);
  },

  newMessage(from: 'user' | 'cine', text: string, command?: string): CineMateMessage {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from,
      text,
      timestamp: Date.now(),
      command,
    };
  },

  appendMessage(mem: CineMateMemoryData, msg: CineMateMessage): CineMateMemoryData {
    const updated = { ...mem, totalMessages: mem.totalMessages + 1, lastMessageAt: msg.timestamp };
    updated.recentTitles = mem.recentTitles.slice(0, 15);
    updated.memories = mem.memories.slice(0, 25);
    return updated;
  },

  addTitle(mem: CineMateMemoryData, kind: 'movie' | 'tv', id: number, title: string): CineMateMemoryData {
    const now = Date.now();
    const exists = mem.recentTitles.find((t) => t.kind === kind && t.id === id);
    let recentTitles = mem.recentTitles;
    if (!exists) {
      recentTitles = [{ kind, id, title, addedAt: now }, ...recentTitles].slice(0, 12);
    }
    return {
      ...mem,
      recentTitles,
      favoriteTitleId: mem.favoriteTitleId ?? id,
      favoriteMediaType: mem.favoriteMediaType ?? kind,
    };
  },

  hasSeen(mem: CineMateMemoryData, kind: 'movie' | 'tv', id: number): boolean {
    return mem.recentTitles.some((t) => t.kind === kind && t.id === id);
  },

  setUserName(mem: CineMateMemoryData, name: string): CineMateMemoryData {
    return { ...mem, userName: name.trim() };
  },

  addMemory(mem: CineMateMemoryData, text: string): CineMateMemoryData {
    const trimmed = text.trim();
    if (!trimmed) return mem;
    const idx = mem.memories.indexOf(trimmed);
    const memories = idx >= 0 ? mem.memories : [...mem.memories, trimmed];
    return { ...mem, memories: memories.slice(0, 25) };
  },

  forgetMemory(mem: CineMateMemoryData, text: string): CineMateMemoryData {
    const trimmed = text.trim();
    const idx = mem.memories.indexOf(trimmed);
    return idx >= 0 ? { ...mem, memories: mem.memories.filter((_, i) => i !== idx) } : mem;
  },

  addMilestone(mem: CineMateMemoryData, key: string): CineMateMemoryData {
    return { ...mem, milestones: { ...mem.milestones, [key]: mem.milestones[key] ? mem.milestones[key] + 1 : 1 } };
  },

  recordGreeting(mem: CineMateMemoryData): CineMateMemoryData {
    return { ...mem, greetingCount: mem.greetingCount + 1, ...CineMateMemory.addMilestone(mem, 'greeted') };
  },

  forgetAll(mem: CineMateMemoryData): CineMateMemoryData {
    const { firstSeen, greetingCount } = mem;
    return { ...DEFAULT_MEMORY, firstSeen, greetingCount };
  },

  exportJson(mem: CineMateMemoryData): string {
    return JSON.stringify({ exportedAt: new Date().toISOString(), ...mem }, null, 2);
  },

  importJson(mem: CineMateMemoryData, json: string): { mem: CineMateMemoryData; error?: string } {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') {
        return { mem, error: 'Invalid data format' };
      }
      return { mem }; // future: restore from parsed
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Parse failed';
      return { mem, error: err.slice(0, 80) };
    }
  },
};
