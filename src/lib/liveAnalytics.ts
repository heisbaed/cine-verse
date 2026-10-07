import { firebaseApp } from './firebase';
import type { TrackingEvent, TrackingSite } from './siteTracking';

export const EVENT_LIMIT = 50_000;
export interface FeedStatus { ready: boolean; error: string | null; capped: boolean; count: number }
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

/** Firebase sends changes over one connection; no periodic full-history reads. */
export function subscribeAnalytics(since: number, onChange: (value: AnalyticsSnapshot) => void): () => void {
  let disposed = false;
  let state = emptySnapshot();
  const rows: Record<TrackingSite, TrackingEvent[]> = { main: [], launch: [] };
  const stops: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = () => {
    if (disposed || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) onChange({ ...state, events: [...rows.main, ...rows.launch], feeds: { ...state.feeds } });
    }, 100);
  };
  void import('firebase/database').then(({ getDatabase, onValue, ref, query, orderByChild, startAt, limitToLast }) => {
    if (disposed) return;
    const db = getDatabase(firebaseApp);
    stops.push(onValue(ref(db, '.info/connected'), (snap) => { state = { ...state, connected: snap.val() === true }; emit(); }));
    stops.push(onValue(ref(db, '.info/serverTimeOffset'), (snap) => { state = { ...state, serverOffset: Number(snap.val()) || 0 }; emit(); }));
    for (const site of ['main', 'launch'] as const) {
      // No endAt(now): newly arriving events must remain inside the query.
      const source = query(ref(db, `analytics/${site}/events`), orderByChild('timestamp'), startAt(since), limitToLast(EVENT_LIMIT));
      stops.push(onValue(source, (snap) => {
        const events: TrackingEvent[] = [];
        snap.forEach((child) => { const value: unknown = child.val(); if (isTrackingEvent(value) && value.site === site) events.push(value); });
        rows[site] = events;
        state = { ...state, updatedAt: Date.now(), feeds: { ...state.feeds, [site]: { ready: true, error: null, capped: snap.size >= EVENT_LIMIT, count: events.length } } };
        emit();
      }, (error) => {
        // Preserve the last good data, but explicitly mark this source as stale.
        state = { ...state, feeds: { ...state.feeds, [site]: { ...state.feeds[site], error: error.message } } };
        emit();
      }));
    }
  }).catch((error: unknown) => {
    if (disposed) return;
    const message = error instanceof Error ? error.message : 'Unable to connect';
    state.feeds.main.error = message; state.feeds.launch.error = message; emit();
  });
  return () => { disposed = true; stops.forEach((stop) => stop()); if (timer) clearTimeout(timer); };
}
