import type { TrackingEvent } from './siteTracking';

export type Surface = 'web' | 'android' | 'ios' | 'native' | 'launch' | 'unknown';
export type SurfaceFilter = 'all' | Surface;
export const SURFACE_LABELS: Record<SurfaceFilter, string> = {
  all: 'All platforms', web: 'Website', android: 'Android app', ios: 'iOS app',
  native: 'Older app', launch: 'Launch page', unknown: 'Unclassified',
};
export const ACTIVE_WINDOW_MS = 90_000;
export const sessionKey = (event: TrackingEvent): string => `${event.site}:${event.sessionId}`;
export const cleanPath = (path: string): string => path.split(/[?#]/)[0].slice(0, 240) || '/';
export const isAudienceEvent = (event: TrackingEvent): boolean => !/^\/dashboard(?:\/|$)/.test(cleanPath(event.path));

export function classifyEvents(events: TrackingEvent[]): Array<TrackingEvent & { surface: Surface }> {
  const sessions = new Map<string, Surface>();
  for (const event of events) {
    const key = sessionKey(event);
    if (event.platform) sessions.set(key, event.platform);
    else if (event.label === 'app-native' && !sessions.has(key)) sessions.set(key, 'native');
  }
  return events.map((event) => ({
    ...event,
    path: cleanPath(event.path),
    surface: event.site === 'launch' ? 'launch' : event.platform || sessions.get(sessionKey(event)) ||
      (event.referrer || event.label === 'app' || event.label === 'app-webview' ? 'web' : 'unknown'),
  }));
}

export function periodBounds(now: number, days: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - days);
  return { start: start.getTime(), previousStart: previousStart.getTime() };
}

export interface TitleMetric {
  key: string; kind: 'movie' | 'tv'; id: number; visits: number; opens: number;
  clicks: number; torrents: number; playbackMs: number; playerOpenMs: number;
}

export function buildAnalytics(raw: TrackingEvent[], now: number, days: number, surface: SurfaceFilter) {
  const { start, previousStart } = periodBounds(now, days);
  const seen = new Set<string>();
  const all = classifyEvents(raw).filter((event) => {
    const key = `${event.site}:${event.id}`;
    if (seen.has(key) || !isAudienceEvent(event) || event.timestamp > now || event.timestamp < previousStart) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.timestamp - b.timestamp);
  const selected = all.filter((event) => surface === 'all' || event.surface === surface);
  const current = selected.filter((event) => event.timestamp >= start);
  const previousViews = selected.filter((event) => event.timestamp < start && event.name === 'page_view').length;
  const sessions = new Set<string>();
  const latestSession = new Map<string, TrackingEvent>();
  const titles = new Map<string, TitleMetric>();
  const paths = new Map<string, number>();
  const mix = new Map<string, number>();
  const surfaceCounts = new Map<Surface, { events: number; sessions: Set<string>; latest: number }>();
  const devices = new Map<string, Set<string>>();
  const daysMap = new Map<string, { timestamp: number; views: number; sessions: Set<string> }>();
  for (let i = 0; i < days; i++) {
    const day = new Date(start); day.setDate(day.getDate() + i);
    daysMap.set(day.toDateString(), { timestamp: day.getTime(), views: 0, sessions: new Set() });
  }
  let views = 0, activeMs = 0, playbackMs = 0, playerOpenMs = 0, opens = 0, searches = 0, downloadClicks = 0;
  let hasPlayback = false, hasPlayerOpen = false, hasDuration = false;
  for (const event of current) {
    const key = sessionKey(event);
    sessions.add(key);
    if (event.name.startsWith('session_')) latestSession.set(key, event);
    const duration = Math.min(30_000, Math.max(0, event.durationMs || 0));
    if (event.name === 'session_heartbeat' || event.name === 'session_end') { activeMs += duration; hasDuration = true; }
    if (event.name === 'media_progress' || event.name === 'media_end') {
      if (event.label === 'native' || event.label === 'playback') { playbackMs += duration; hasPlayback = true; }
      if (event.label === 'embed') { playerOpenMs += duration; hasPlayerOpen = true; }
    }
    if (event.name === 'media_start') opens++;
    if (event.name === 'search') searches++;
    if (event.name === 'apk_download') downloadClicks++;
    const day = daysMap.get(new Date(event.timestamp).toDateString());
    day?.sessions.add(key);
    if (event.name === 'page_view') {
      views++; if (day) day.views++;
      paths.set(event.path, (paths.get(event.path) || 0) + 1);
    }
    if (!event.name.startsWith('session_')) mix.set(event.name, (mix.get(event.name) || 0) + 1);
    const deviceSessions = devices.get(event.device) || new Set<string>();
    deviceSessions.add(key); devices.set(event.device, deviceSessions);
    const match = event.path.match(/^\/(movie|tv)\/(\d+)(?:\/|$)/);
    if (match) {
      const titleKey = `${match[1]}-${match[2]}`;
      const title = titles.get(titleKey) || { key: titleKey, kind: match[1] as 'movie' | 'tv', id: Number(match[2]), visits: 0, opens: 0, clicks: 0, torrents: 0, playbackMs: 0, playerOpenMs: 0 };
      if (event.name === 'page_view') title.visits++;
      if (event.name === 'media_start') title.opens++;
      if (event.name === 'cta_click') { title.clicks++; if (event.label?.startsWith('torrent')) title.torrents++; }
      if (event.name === 'media_progress' || event.name === 'media_end') {
        if (event.label === 'native' || event.label === 'playback') title.playbackMs += duration;
        if (event.label === 'embed') title.playerOpenMs += duration;
      }
      titles.set(titleKey, title);
    }
  }
  for (const event of all.filter((e) => e.timestamp >= start)) {
    const entry = surfaceCounts.get(event.surface) || { events: 0, sessions: new Set<string>(), latest: 0 };
    entry.events++; entry.sessions.add(sessionKey(event)); entry.latest = event.timestamp;
    surfaceCounts.set(event.surface, entry);
  }
  const countActive = (time: number, latest: Iterable<TrackingEvent>) => Array.from(latest).filter((event) =>
    event.name !== 'session_end' && event.timestamp > time - ACTIVE_WINDOW_MS && event.timestamp <= time,
  ).length;
  // A rolling 90-second presence window sampled each minute, including session ends.
  const pulse: Array<{ timestamp: number; value: number }> = [];
  const presence = selected.filter((e) => e.name.startsWith('session_'));
  const liveSessions = new Map<string, TrackingEvent>();
  let cursor = 0;
  for (let i = 29; i >= 0; i--) {
    const time = now - i * 60_000;
    while (cursor < presence.length && presence[cursor].timestamp <= time) {
      const event = presence[cursor++]; liveSessions.set(sessionKey(event), event);
    }
    pulse.push({ timestamp: time, value: countActive(time, liveSessions.values()) });
  }
  return {
    current, views, previousViews, sessions: sessions.size, activeNow: countActive(now, latestSession.values()),
    activeMs, playbackMs, playerOpenMs, opens, searches, downloadClicks, hasPlayback, hasPlayerOpen, hasDuration,
    averageSessionMs: sessions.size ? activeMs / sessions.size : 0,
    chart: Array.from(daysMap.values()).map((day) => ({ ...day, sessions: day.sessions.size })), pulse,
    titles: Array.from(titles.values()).sort((a, b) => b.visits - a.visits || b.opens - a.opens || b.clicks - a.clicks).slice(0, 10),
    paths: Array.from(paths).sort((a, b) => b[1] - a[1]).slice(0, 6),
    mix: Array.from(mix).sort((a, b) => b[1] - a[1]),
    devices: Array.from(devices).map(([name, values]) => ({ name, count: values.size })),
    surfaces: Array.from(surfaceCounts).map(([name, values]) => ({ name, ...values, sessions: values.sessions.size })),
    latest: current.length ? current[current.length - 1].timestamp : null,
  };
}
