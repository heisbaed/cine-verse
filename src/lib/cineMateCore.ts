import type { MediaItem, MediaType } from '@/types/tmdb';
import type {
  BroadcastChat,
  BroadcastFact,
  BroadcastGreeting,
  BroadcastMood,
  BroadcastPoke,
  BroadcastTip,
  CineMateMood,
  CineMateMessage,
  CineMatePreferences,
  CineMateAnalyticsData,
} from '@/types/cinemate';
import { MOOD_COLORS } from '@/types/cinemate';
import { getMediaTitle, getMediaDate, getMediaType } from '@/utils/media';
import {
  greetingForTime,
  observeRoute,
  observeTitle,
  observeWatchlist,
  observeAnalytics,
  pickIdleChatter,
  pickObservation,
  answer,
} from './cineMateEngine';
import { CineMateMemory } from './cineMateMemory';

type SyncAction = 'dance' | 'sing';

export interface CineMateState {
  mood: CineMateMood;
  eyeOffset: { x: number; y: number };
  eyelids: 'open' | 'closed' | 'half' | 'squint';
  mouth: 'neutral' | 'smile' | 'wide-smile' | 'frown' | 'surprised' | 'oh' | 'zip';
  headTilt: number;
  messages: CineMateMessage[];
  input: string;
  open: boolean;
  minimized: boolean;
  initialized: boolean;
  name: string;
  accent: string;
  voiceEnabled: boolean;
  voiceVolume: number;
  voiceRate: number;
  lastObservedRoute: string | null;
  lastObservedTitle: { kind: 'movie' | 'tv'; id: number; title: string } | null;
  watchlistCount: number;
  analytics: CineMateAnalyticsData | undefined;
  syncAction: SyncAction | null;
  greetingCooldown: number;
  lastIdlenessTick: number;
}

const initialState: CineMateState = {
  mood: 'idle',
  eyeOffset: { x: 0, y: 0 },
  eyelids: 'open',
  mouth: 'neutral',
  headTilt: 0,
  messages: [],
  input: '',
  open: false,
  minimized: false,
  initialized: false,
  name: '',
  accent: '#64ffda',
  voiceEnabled: false,
  voiceVolume: 1,
  voiceRate: 1,
  lastObservedRoute: null,
  lastObservedTitle: null,
  watchlistCount: 0,
  analytics: undefined,
  syncAction: null,
  greetingCooldown: 0,
  lastIdlenessTick: Date.now(),
};

const STATE_KEY = 'cine-mate-core-state-v1';

const loadState = (): CineMateState => {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CineMateState>;
      if (parsed.initialized && parsed.messages?.length) return { ...initialState, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return initialState;
};

const saveState = (state: CineMateState): void => {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — still works */
  }
};

const now = () => Date.now();

let state: CineMateState = loadState();
const listeners = new Set<() => void>();
let idlenessTimer: number | null = null;
let speakQueue: string[] = [];
let speechCanceled = false;

const setMood = (newMood: CineMateMood, opts?: { soft?: boolean }): void => {
  if (state.mood === newMood && !opts?.soft) return;
  const prev = state.mood;
  state.mood = newMood;
  state.lastIdlenessTick = now();
  notify();
  dispatchMood(newMood);
  if (prev === 'sleepy' && newMood !== 'sleepy') {
    wakeUpSilently();
  }
};

const notify = (): void => {
  for (const fn of listeners) fn();
  saveState(state);
};

const dispatchMood = (mood: CineMateMood): void => {
  window.dispatchEvent(
    new CustomEvent<CineMateMood>('cine-mate:mood', { detail: mood }),
  );
};

const scheduleIdleness = (): void => {
  if (idlenessTimer !== null) {
    window.clearTimeout(idlenessTimer);
  }
  // Wake every 45s to check; fall back to idle chat after ~20s of pure idleness.
  idlenessTimer = window.setTimeout(() => {
    if (state.open) return;
    if (state.mood === 'sleepy' || state.mood === 'loading' || state.syncAction) return;
    const idleMs = now() - state.lastIdlenessTick;
    if (idleMs > 20_000 && !state.open) {
      const text = pickIdleChatter(state.analytics, state.lastObservedTitle?.title, state.watchlistCount);
      addMessage('cine', text, 'idle');
      setMood('curious', { soft: true });
      void speak(text);
    }
    scheduleIdleness();
  }, 45_000);
};

const wakeUpSilently = (): void => {
  setMood('idle');
  setEyelids('open');
  setMouth('neutral');
  setHeadTilt(0);
};

const setEyelids = (e: CineMateState['eyelids']): void => {
  state.eyeOffset = { x: 0, y: 0 };
  state.eyelids = e;
  notify();
};

const setMouth = (m: CineMateState['mouth']): void => {
  state.mouth = m;
  notify();
};

const setHeadTilt = (t: number): void => {
  state.headTilt = t;
  notify();
};

const addMessage = (from: 'user' | 'cine', text: string, command?: string): CineMateMessage => {
  const msg = CineMateMemory.newMessage(from, text, command);
  state.messages.push(msg);
  if (state.messages.length > 40) state.messages.shift();
  const mem = CineMateMemory.load();
  CineMateMemory.save(CineMateMemory.appendMessage(mem, msg));
  notify();
  return msg;
};

const scheduleGreeting = (forceText?: string): void => {
  const cooldown = forceText ? 0 : 60_000;
  if (now() < state.greetingCooldown) return;
  window.setTimeout(() => {
    if (state.mood === 'sleepy' || state.open) return;
    const { text, mood } = forceText
      ? { text: forceText, mood: 'happy' }
      : greetingForTime();
    addMessage('cine', text, 'greeting');
    setMood(mood);
    void speak(text);
    state.greetingCooldown = now() + cooldown;
    const mem = CineMateMemory.load();
    CineMateMemory.save(CineMateMemory.recordGreeting(mem));
  }, 2500);
};

const synthesize = async (text: string): Promise<void> => {
  if (!('speechSynthesis' in window)) return;
  const merged = [...speakQueue, text];
  speakQueue = merged;
  speechCanceled = false;
  await new Promise<void>((resolve) => {
    const finish = () => {
      speechCanceled = true;
      speakQueue = speakQueue.filter((t) => t !== text);
      if (speakQueue.length) void synthesize(speakQueue[0]);
      resolve();
    };
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = state.voiceRate;
    utter.volume = state.voiceVolume;
    utter.onend = () => finish();
    utter.onerror = () => finish();
    window.speechSynthesis.speak(utter);
  });
};

export const speak = (text: string): Promise<void> => {
  if (!state.voiceEnabled) {
    addMessage('cine', text);
    return Promise.resolve();
  }
  return synthesize(text);
};

export const broadcast = (event: BroadcastGreeting | BroadcastFact | BroadcastTip | BroadcastChat): void => {
  if (state.mood === 'sleepy') return;
  const { type, text } = event;
  if (type === 'greeting') scheduleGreeting(text);
  else addMessage('cine', text, type);
};

const processCommand = (question: string): { reply: string; mood: CineMateMood; action: SyncAction | null } => {
  const qn = question.toLowerCase();
  if (qn.match(/(dance|wiggle|spin|boogie)/)) {
    return { reply: 'Wiggle wiggle! My servos love this part.', mood: 'excited', action: 'dance' };
  }
  if (qn.match(/(sing|song|music|la-la)/)) {
    return { reply: pickSingSong(), mood: 'excited', action: 'sing' };
  }
  const res = answer(question, state.analytics);
  return { reply: res.text, mood: res.mood, action: res.action ?? null };
};

const pickSingSong = (): string => {
  const songs = [
    'La la la, movies in my head ♪',
    'Beep-boop-doo-wop, data in the flow ♪',
    'Render render render, we are going slow ♪',
    'Pixel perfect, screen so bright, watching every night and every light ♪',
  ];
  return songs[Math.floor(Math.random() * songs.length)];
};

export const handlePoke = (): void => {
  if (state.mood === 'sleepy') {
    wakeUpSilently();
    setHeadTilt(6);
    window.setTimeout(() => setHeadTilt(0), 400);
    void speak('I am awake now!');
    setMood('happy');
    return;
  }
  setMood('excited');
  setHeadTilt(8);
  window.setTimeout(() => setHeadTilt(0), 300);
  void speak('Beep! Hello!');
  state.lastIdlenessTick = now();
};

export const onRouteChange = (path: string, title?: MediaItem): void => {
  if (state.mood === 'sleepy' || state.open) return;
  const prev = state.lastObservedRoute;
  state.lastObservedRoute = path;
  if (prev && path === prev) return;
  state.lastObservedTitle = null;
  let obs: ReturnType<typeof observeRoute>;
  if (title && 'id' in title && 'poster_path' in title && getMediaTitle(title)) {
    obs = observeRoute(path, title);
  } else {
    obs = observeRoute(path);
  }
  if (obs.text && now() - state.lastIdlenessTick > 8_000) {
    addMessage('cine', obs.text, 'route');
    setMood(obs.mood);
    void speak(obs.text);
  }
};

export const onTitleViewed = (item: MediaItem): void => {
  const kind = getMediaType(item) as 'movie' | 'tv';
  const title = getMediaTitle(item);
  const mem = CineMateMemory.load();
  CineMateMemory.save(CineMateMemory.addTitle(mem, kind, item.id, title));
  if (CineMateMemory.hasSeen(mem, kind, item.id)) return;
  if (state.mood === 'sleepy' || state.open) return;
  const obs = observeTitle(item);
  if (obs.text && now() - state.lastIdlenessTick > 8_000) {
    addMessage('cine', obs.text, 'title');
    setMood(obs.mood);
    state.lastObservedTitle = { kind, id: item.id, title };
    void speak(obs.text);
  }
};

export const onWatchlistChange = (added?: MediaItem, removed?: MediaItem): void => {
  if (state.mood === 'sleepy' || state.open) return;
  if (added) {
    const text = observeWatchlist('add', added);
    const title = getMediaTitle(added);
    const kind = getMediaType(added) as 'movie' | 'tv';
    const mem = CineMateMemory.load();
    CineMateMemory.save(CineMateMemory.addTitle(mem, kind, added.id, title));
    addMessage('cine', text, 'watchlist-add');
    void speak(text);
  }
  if (removed) {
    const text = observeWatchlist('remove', removed);
    addMessage('cine', text, 'watchlist-remove');
    void speak(text);
  }
  state.watchlistCount = state.analytics?.views ? 0 : 0;
};

export const onAnalyticsUpdate = (data: CineMateAnalyticsData): void => {
  state.analytics = data;
  const obs = observeAnalytics(data);
  if (obs.text && now() - state.lastIdlenessTick > 30_000 && !state.open) {
    addMessage('cine', obs.text, 'analytics');
    setMood(obs.mood);
    void speak(obs.text);
  }
};

export const sendInput = (input: string): { reply: string; mood: CineMateMood; action: SyncAction | null } => {
  const reply = processCommand(input);
  addMessage('user', input);
  setMood(reply.mood);
  void speak(reply.reply);
  state.lastIdlenessTick = now();
  return reply;
};

export const handleRemember = (text: string): void => {
  const mem = CineMateMemory.load();
  CineMateMemory.save(CineMateMemory.addMemory(mem, text));
  addMessage('cine', 'Noted. I have saved that.', 'remember');
  void speak('Noted.');
};

export const handleForget = (text: string): void => {
  const mem = CineMateMemory.load();
  const updated = CineMateMemory.forgetMemory(mem, text);
  CineMateMemory.save(updated);
  if (updated.memories.length < mem.memories.length) {
    addMessage('cine', `I have forgotten "${text}".`, 'forget');
    void speak('Gone.');
  } else {
    addMessage('cine', `I could not find "${text}" in my memory.`, 'forget');
  }
};

export const handleSetUserName = (name: string): void => {
  const mem = CineMateMemory.load();
  CineMateMemory.save(CineMateMemory.setUserName(mem, name));
  state.name = name;
  notify();
};

export const setSyncAction = (action: SyncAction | null): void => {
  state.syncAction = action;
  if (action) {
    window.setTimeout(() => {
      state.syncAction = null;
      notify();
    }, action === 'dance' ? 1300 : 5000);
  }
};

export const openChat = (): void => {
  if (state.open) return;
  state.open = true;
  state.mood = 'curious';
  notify();
};

export const closeChat = (): void => {
  if (!state.open) return;
  state.open = false;
  state.eyelids = 'open';
  state.mouth = 'neutral';
  notify();
};

const sleep = (): void => {
  if (state.mood === 'sleepy') return;
  state.mood = 'sleepy';
  state.eyelids = 'closed';
  state.mouth = 'zip';
  state.headTilt = 0;
  scheduleIdleness();
  notify();
  addMessage('cine', 'Powering down for a catnap… tap me to wake me early.', 'sleep');
};

window.addEventListener('focus', () => {
  if (state.mood === 'sleepy') wakeUpSilently();
});

export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getState = (): CineMateState => ({ ...state });

export const cineMateCore = {
  getState,
  subscribe,
  setMood,
  handlePoke,
  sendInput,
  onRouteChange,
  onTitleViewed,
  onWatchlistChange,
  onAnalyticsUpdate,
  handlePoke,
  handleRemember,
  handleForget,
  handleSetUserName,
  setSyncAction,
  openChat,
  closeChat,
  broadcast,
  sleep,
};

if (typeof window !== 'undefined') {
  const init = (): void => {
    if (state.initialized) return;
    state.initialized = true;
    const mem = CineMateMemory.load();
    CineMateMemory.save(mem);
    state.name = mem.userName || '';
    const prefs = CineMateMemory.loadPrefs();
    state.accent = MOOD_COLORS[prefs.accent === 'electric' ? 'electric' : (prefs.accent as CineMateMood)] || '#64ffda';
    state.voiceEnabled = prefs.voiceEnabled;
    state.voiceVolume = prefs.voiceVolume;
    state.voiceRate = prefs.voiceRate;
    notify();
    scheduleIdleness();
    scheduleGreeting();
  };
  window.requestAnimationFrame(init);
}
