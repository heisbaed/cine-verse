import { firebaseApp } from './firebase';
import type { User } from 'firebase/auth';
import type { TrackingEvent, TrackingSite } from './siteTracking';

export const EVENT_LIMIT = 50_000;
export interface FeedStatus {
  ready: boolean;
  error: string | null;
  capped: boolean;
  count: number;
  source?: 'live' | 'refresh' | 'previous';
}
export interface AnalyticsSnapshot {
  events: TrackingEvent[]; connected: boolean; updatedAt: number | null; serverOffset: number;
  feeds: Record<TrackingSite, FeedStatus>;
}
export const emptySnapshot = (): AnalyticsSnapshot => ({
  events: [], connected: false, updatedAt: null, serverOffset: 0,
  feeds: { main: { ready: false, error: null, capped: false, count: 0 }, launch: { ready: false, error: null, capped: false, count: 0 } },
});

export function isTrackingEvent(value: unknown): value is TrackingEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as TrackingEvent;
  return typeof e.id === 'string' && typeof e.name === 'string' &&
    (e.site === 'main' || e.site === 'launch') && typeof e.path === 'string' &&
    typeof e.timestamp === 'number' && Number.isFinite(e.timestamp) &&
    typeof e.sessionId === 'string' && ['mobile', 'desktop', 'tablet'].includes(e.device);
}

const SITES = ['main', 'launch'] as const;
const REFRESH_INTERVAL = 60_000;

async function readFeed(site: TrackingSite, since: number, user: User, signal: AbortSignal) {
  const token = await user.getIdToken();
  const url = new URL(`/analytics/${site}/events.json`, firebaseApp.options.databaseURL);
  url.searchParams.set('auth', token);
  url.searchParams.set('orderBy', '"timestamp"');
  url.searchParams.set('startAt', String(since));
  url.searchParams.set('limitToLast', String(EVENT_LIMIT));
  const response = await fetch(url, { signal, cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (response.status === 401 || response.status === 403) {
    throw new Error('Firebase denied analytics access for this account.');
  }
  if (!response.ok) throw new Error(`Analytics request failed (HTTP ${response.status}).`);
  const raw: unknown = await response.json();
  if (raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw new Error('Invalid analytics response.');
  return raw ? Object.values(raw) : [];
}

/** Listen in realtime, with a private authenticated snapshot fallback if the socket is unavailable. */
export function subscribeAnalytics(
  since: number,
  user: User,
  onChange: (value: AnalyticsSnapshot) => void,
  previous?: AnalyticsSnapshot,
): () => void {
  const controller = new AbortController();
  let disposed = false;
  let state = emptySnapshot();
  const rows: Record<TrackingSite, TrackingEvent[]> = { main: [], launch: [] };
  if (previous) {
    for (const site of SITES) {
      rows[site] = previous.events.filter((event) => event.site === site && event.timestamp >= since);
      state.feeds[site] = { ...previous.feeds[site], source: 'previous', error: null, count: rows[site].length };
    }
    state.serverOffset = previous.serverOffset;
    state.updatedAt = previous.updatedAt;
  }

  const stops: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  const emit = () => {
    if (disposed || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) onChange({ ...state, events: [...rows.main, ...rows.launch], feeds: { ...state.feeds } });
    }, 100);
  };
  const updateFeed = (site: TrackingSite, source: 'live' | 'refresh', raw: unknown[]) => {
    const events = raw.filter((value): value is TrackingEvent => isTrackingEvent(value) && value.site === site);
    rows[site] = events;
    state = {
      ...state, updatedAt: Date.now(),
      feeds: { ...state.feeds, [site]: { ready: true, error: null, capped: raw.length >= EVENT_LIMIT, count: events.length, source } },
    };
    emit();
  };
  const setError = (site: TrackingSite, message: string) => {
    state = { ...state, feeds: { ...state.feeds, [site]: { ...state.feeds[site], error: message } } };
    emit();
  };
  const hasLiveFeed = (site: TrackingSite) => state.connected && state.feeds[site].source === 'live' && !state.feeds[site].error;
  const refresh = async () => {
    if (disposed || refreshing || SITES.every(hasLiveFeed)) return;
    refreshing = true;
    try {
      await Promise.all(SITES.filter((site) => !hasLiveFeed(site)).map(async (site) => {
        try {
          const raw = await readFeed(site, since, user, AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]));
          if (!disposed && !hasLiveFeed(site)) updateFeed(site, 'refresh', raw);
        } catch (error) {
          if (disposed || hasLiveFeed(site)) return;
          // Fetch errors can contain the authenticated URL. Only show our own messages.
          const message = error instanceof Error && /^(Firebase denied|Analytics request failed|Invalid analytics response)/.test(error.message)
            ? error.message : 'Could not refresh analytics. Reconnecting automatically.';
          setError(site, message);
        }
      }));
    } finally {
      refreshing = false;
    }
  };

  const initial = setTimeout(() => void refresh(), 5_000);
  const interval = setInterval(() => void refresh(), REFRESH_INTERVAL);
  const onOnline = () => { void refresh(); };
  window.addEventListener('online', onOnline);
  emit();
  void import('firebase/database').then(({ getDatabase, onValue, ref, query, orderByChild, startAt, limitToLast }) => {
    if (disposed) return;
    const db = getDatabase(firebaseApp);
    stops.push(onValue(ref(db, '.info/connected'), (snap) => {
      const connected = snap.val() === true;
      if (!connected && state.connected) {
        for (const site of SITES) {
          if (state.feeds[site].source === 'live') {
            state.feeds = { ...state.feeds, [site]: { ...state.feeds[site], source: 'previous' } };
          }
        }
      }
      state = { ...state, connected };
      emit();
    }));
    stops.push(onValue(ref(db, '.info/serverTimeOffset'), (snap) => { state = { ...state, serverOffset: Number(snap.val()) || 0 }; emit(); }));
    for (const site of SITES) {
      const source = query(ref(db, `analytics/${site}/events`), orderByChild('timestamp'), startAt(since), limitToLast(EVENT_LIMIT));
      stops.push(onValue(source, (snap) => {
        if (!state.connected && state.feeds[site].ready) return;
        const events: unknown[] = [];
        snap.forEach((child) => { events.push(child.val()); });
        updateFeed(site, 'live', events);
      }, () => {
        setError(site, 'Live connection unavailable.');
        void refresh();
      }));
    }
  }).catch(() => { void refresh(); });
  return () => {
    disposed = true;
    controller.abort();
    stops.forEach((stop) => stop());
    clearTimeout(timer);
    clearTimeout(initial);
    clearInterval(interval);
    window.removeEventListener('online', onOnline);
  };
}
