import { firebaseApp } from '@/lib/firebase';

export type TrackingSite = 'main' | 'launch';

export type TrackingEventName =
  | 'page_view'
  | 'apk_download'
  | 'cta_click'
  | 'search'
  | 'media_view'
  | 'session_start'
  | 'session_heartbeat'
  | 'session_end'
  | 'media_start'
  | 'media_progress'
  | 'media_end';

export interface TrackingEvent {
  id: string;
  name: TrackingEventName;
  site: TrackingSite;
  path: string;
  label?: string;
  timestamp: number;
  sessionId: string;
  device: 'mobile' | 'desktop' | 'tablet';
  referrer?: string;
  durationMs?: number;
  mediaPositionMs?: number;
  platform?: 'web' | 'android' | 'ios';
  schemaVersion?: number;
}

const EVENTS_KEY = 'cineverse-signal-events-v1';
const SESSION_KEY = 'cineverse-signal-session-v2';
const SESSION_STARTED_KEY = 'cineverse-signal-session-started-v2';
const MAX_EVENTS = 2500;
const TRACKING_SITES: TrackingSite[] = ['main', 'launch'];

const getSite = (): TrackingSite =>
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('cine-verse-231ad') ||
    window.location.hostname.includes('launch'))
    ? 'launch'
    : 'main';

const getDevice = (): TrackingEvent['device'] => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

let fallbackSessionId: string | null = null;

const isAppWrapper = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /\bwv\b/.test(ua) || (ua.includes('Android') && ua.includes('Version/'));
};

const getSessionId = (): string => {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, value);
    return value;
  } catch {
    // Some WebView wrappers disable session storage. Fall back to memory so
    // one failed storage API never kills telemetry for the whole session.
    if (!fallbackSessionId) {
      fallbackSessionId = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return fallbackSessionId;
  }
};

export const readTrackingEvents = (): TrackingEvent[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(EVENTS_KEY) || '[]',
    ) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((event): event is TrackingEvent => {
          if (!event || typeof event !== 'object') return false;
          const value = event as Partial<TrackingEvent>;
          return (
            typeof value.id === 'string' &&
            typeof value.name === 'string' &&
            typeof value.site === 'string' &&
            typeof value.path === 'string' &&
            typeof value.timestamp === 'number' &&
            typeof value.sessionId === 'string'
          );
        })
      : [];
  } catch {
    return [];
  }
};

export const trackEvent = (
  name: TrackingEventName,
  details: {
    path?: string;
    label?: string;
    durationMs?: number;
    mediaPositionMs?: number;
  } = {},
): void => {
  if (typeof window === 'undefined') return;
  const path = (details.path || window.location.pathname).split(/[?#]/)[0].slice(0, 240);
  if (/^\/dashboard(?:\/|$)/.test(path)) return;
  let referrer: string | undefined;
  try { if (document.referrer) referrer = new URL(document.referrer).hostname; } catch { /* An invalid referrer cannot block an event. */ }
  const event: TrackingEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    site: getSite(),
    path,
    ...(details.label ? { label: details.label.slice(0, 80) } : {}),
    timestamp: Date.now(),
    sessionId: getSessionId(),
    device: getDevice(),
    platform: 'web',
    schemaVersion: 2,
    ...(referrer ? { referrer } : {}),
    ...(typeof details.durationMs === 'number' && Number.isFinite(details.durationMs)
      ? { durationMs: Math.min(30_000, Math.max(0, Math.round(details.durationMs))) }
      : {}),
    ...(typeof details.mediaPositionMs === 'number' && Number.isFinite(details.mediaPositionMs)
      ? { mediaPositionMs: Math.max(0, Math.round(details.mediaPositionMs)) }
      : {}),
  };

  const events = [...readTrackingEvents(), event].slice(-MAX_EVENTS);
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    window.dispatchEvent(new Event('cineverse:tracking-updated'));
  } catch {
    // Analytics must never interrupt the cinema experience when storage is
    // full or disabled (some app wrappers disable DOM storage).
  }
  // Remote publish runs independently of local storage so a storage failure
  // can never silently drop the Firebase signal.
  void publishRemoteEvent(event);
};

let stopSessionTracking: (() => void) | null = null;

/**
 * Records only visible, active app time. Heartbeats are deliberately short and
 * bounded so a sleeping tab never turns into an inflated session.
 */
export const startSessionTracking = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  if (stopSessionTracking) return stopSessionTracking;

  // Label wrapper sessions so the dashboard can prove the installed APK is
  // running current code and reaching Firebase.
  const sessionLabel = isAppWrapper() ? 'app-webview' : 'app';

  let sessionStarted = true;
  try {
    sessionStarted = window.sessionStorage.getItem(SESSION_STARTED_KEY) !== '1';
    if (sessionStarted) window.sessionStorage.setItem(SESSION_STARTED_KEY, '1');
  } catch {
    sessionStarted = true;
  }
  if (sessionStarted) {
    trackEvent('session_start', { label: sessionLabel });
  }

  let lastPulseAt = Date.now();
  let visible = document.visibilityState === 'visible';
  const flush = (eventName: 'session_heartbeat' | 'session_end') => {
    const now = Date.now();
    const durationMs = Math.min(Math.max(0, now - lastPulseAt), 30_000);
    if (visible && (durationMs > 0 || eventName === 'session_end')) {
      trackEvent(eventName, { label: sessionLabel, durationMs });
    }
    lastPulseAt = now;
  };
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') flush('session_heartbeat');
  }, 15_000);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      lastPulseAt = Date.now();
      visible = true;
      trackEvent('session_start', { label: sessionLabel });
    } else {
      flush('session_end');
      visible = false;
    }
  };
  const onPageHide = () => { flush('session_end'); visible = false; };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  const cleanup = () => {
    flush('session_end');
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    if (stopSessionTracking === cleanup) stopSessionTracking = null;
  };
  stopSessionTracking = cleanup;
  return cleanup;
};

const publishRemoteEvent = async (event: TrackingEvent): Promise<void> => {
  try {
    const { getDatabase, push, ref, set, serverTimestamp } = await import('firebase/database');
    const database = getDatabase(firebaseApp);
    const eventRef = push(ref(database, `analytics/${event.site}/events`));
    await set(eventRef, { ...event, timestamp: serverTimestamp() });
  } catch (error) {
    console.warn('Analytics event could not be delivered', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const readRemoteTrackingEvents = async (
  days = 30,
): Promise<TrackingEvent[]> => {
  const {
    endAt,
    get,
    getDatabase,
    limitToLast,
    orderByChild,
    query,
    ref,
    startAt,
  } = await import('firebase/database');
  const database = getDatabase(firebaseApp);
  const now = Date.now();
  const since = now - days * 24 * 60 * 60 * 1000;
  const snapshots = await Promise.all(
    TRACKING_SITES.map((site) =>
      get(
        query(
          ref(database, `analytics/${site}/events`),
          orderByChild('timestamp'),
          startAt(since),
          endAt(now),
          limitToLast(MAX_EVENTS),
        ),
      ),
    ),
  );
  const remoteEvents: TrackingEvent[] = [];
  snapshots.forEach((snapshot) => {
    snapshot.forEach((child) => {
      const value = child.val() as Partial<TrackingEvent>;
      if (
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        typeof value.site === 'string' &&
        typeof value.path === 'string' &&
        typeof value.timestamp === 'number' &&
        typeof value.sessionId === 'string' &&
        typeof value.device === 'string'
      ) {
        remoteEvents.push(value as TrackingEvent);
      }
    });
  });
  return remoteEvents.sort((left, right) => left.timestamp - right.timestamp);
};

export const trackPageView = (path: string): void => {
  const recentEvents = readTrackingEvents();
  const recent = recentEvents[recentEvents.length - 1];
  if (
    recent?.name === 'page_view' &&
    recent.path === path &&
    Date.now() - recent.timestamp < 1200
  ) {
    return;
  }
  trackEvent('page_view', { path });
};

export const clearTrackingEvents = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(EVENTS_KEY);
  } catch {
    // Storage may be unavailable in some app wrappers.
  }
  window.dispatchEvent(new Event('cineverse:tracking-updated'));
};
