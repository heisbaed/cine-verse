import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clapperboard,
  Clock3,
  Database,
  Download,
  ExternalLink,
  FileDown,
  Globe2,
  LayoutDashboard,
  Lock,
  Monitor,
  Moon,
  MousePointer2,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Sun,
  Tablet,
  UserRound,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getMovieDetails, getTVDetails } from '@/api/tmdb';
import {
  readRemoteTrackingEvents,
  type TrackingEvent,
} from '@/lib/siteTracking';

type SiteFilter = 'all' | 'main' | 'launch';
type Range = 7 | 30;
type Theme = 'dark' | 'light';

interface GitHubRelease {
  assets?: Array<{ name?: string; download_count?: number }>;
}

const DASHBOARD_ADMINS: string[] = (
  (import.meta.env.VITE_DASHBOARD_ADMINS as string | undefined) ||
  'charlesbabuu0@gmail.com'
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email?: string | null): boolean =>
  !!email && DASHBOARD_ADMINS.includes(email.trim().toLowerCase());

const formatNumber = (value: number): string =>
  new Intl.NumberFormat('en-US', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);

const formatTime = (timestamp: number): string =>
  new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(timestamp);

const formatDay = (timestamp: number): string =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(timestamp).slice(0, 2);

const relativeTime = (timestamp: number): string => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
};

const formatDuration = (durationMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const downloadCsv = (events: TrackingEvent[]): void => {
  const header = 'timestamp,event,site,path,label,session,device';
  const rows = events.map((event) =>
    [
      new Date(event.timestamp).toISOString(),
      event.name,
      event.site,
      event.path,
      event.label || '',
      event.sessionId,
      event.device,
    ].map((value) => `"${String(value).split('"').join('""')}"`).join(','),
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `cineverse-signal-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const Dashboard: React.FC = () => {
  const { user, authLoading, authError, signInWithGoogle, logOut } = useAuth();
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [site, setSite] = useState<SiteFilter>('all');
  const [range, setRange] = useState<Range>(7);
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('cine-verse-theme') === 'light' ? 'light' : 'dark',
  );
  const [source, setSource] = useState<'local' | 'loading' | 'live' | 'fallback'>('local');
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [githubDownloads, setGithubDownloads] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const isAuthorized = !!user && isAdminEmail(user.email);

  const refresh = useCallback(async () => {
    if (!isAuthorized) {
      setEvents([]);
      setSource('local');
      setSourceError(null);
      setLastUpdated(Date.now());
      return;
    }
    setSource('loading');
    try {
      const remote = await readRemoteTrackingEvents(30);
      setEvents(remote);
      setSource('live');
      setSourceError(null);
      setLastUpdated(Date.now());
    } catch (error) {
      setEvents([]);
      setSource('fallback');
      setSourceError(error instanceof Error ? error.message : 'Firebase read failed');
      setLastUpdated(Date.now());
    }
  }, [isAuthorized]);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener('cineverse:tracking-updated', onUpdate);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 15_000);
    return () => {
      window.removeEventListener('cineverse:tracking-updated', onUpdate);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('cine-verse-theme', theme);
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://api.github.com/repos/heisbaed/cine-verse/releases?per_page=100', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('GitHub unavailable'))))
      .then((releases: GitHubRelease[]) => {
        const total = releases.reduce((sum, release) =>
          sum + (release.assets || []).reduce((assetSum, asset) =>
            assetSum + (asset.name?.toLowerCase().endsWith('.apk') ? asset.download_count || 0 : 0), 0), 0);
        setGithubDownloads(total);
      })
      .catch(() => setGithubDownloads(null));
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;
    return events.filter((event) => event.timestamp >= cutoff && (site === 'all' || event.site === site));
  }, [events, range, site]);

  const previous = useMemo(() => {
    const end = Date.now() - range * 24 * 60 * 60 * 1000;
    const start = end - range * 24 * 60 * 60 * 1000;
    return events.filter((event) => event.timestamp >= start && event.timestamp < end && (site === 'all' || event.site === site));
  }, [events, range, site]);

  const pageViews = filtered.filter((event) => event.name === 'page_view').length;
  const sessions = new Set(filtered.map((event) => event.sessionId)).size;
  const activeAppMs = filtered
    .filter((event) => event.name === 'session_heartbeat' || event.name === 'session_end')
    .reduce((total, event) => total + (event.durationMs || 0), 0);
  const watchMs = filtered
    .filter((event) => event.name === 'media_progress' || event.name === 'media_end')
    .reduce((total, event) => total + (event.durationMs || 0), 0);
  const averageSessionMs = sessions ? activeAppMs / sessions : 0;
  const heartbeatEvents = filtered.filter((event) => event.name === 'session_heartbeat').length;
  const activeNow = useMemo(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return new Set(
      filtered.filter((event) => event.timestamp >= cutoff).map((event) => event.sessionId),
    ).size;
  }, [filtered]);
  const heartbeatLive = activeNow > 0;
  const previousViews = previous.filter((event) => event.name === 'page_view').length;
  const viewDelta = previousViews ? Math.round(((pageViews - previousViews) / previousViews) * 100) : 0;

  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(now.getDate() - (13 - index));
      const start = day.getTime();
      const end = start + 86400000;
      const value = filtered.filter((event) => event.name === 'page_view' && event.timestamp >= start && event.timestamp < end).length;
      return { label: formatDay(start), value };
    });
  }, [filtered]);
  const chartMax = Math.max(1, ...chart.map((item) => item.value));

  const pulse = useMemo(() => {
    const buckets = 12;
    const bucketMs = 5 * 60 * 1000;
    const now = Date.now();
    return Array.from({ length: buckets }, (_, index) => {
      const start = now - (buckets - 1 - index) * bucketMs;
      const end = start + bucketMs;
      const users = new Set(
        filtered.filter((event) => event.timestamp >= start && event.timestamp < end).map((event) => event.sessionId),
      ).size;
      return { label: formatTime(start), value: users };
    });
  }, [filtered, lastUpdated]);
  const pulseMax = Math.max(1, ...pulse.map((item) => item.value));
  const pulsePoints = pulse.map((item, index) => {
    const x = pulse.length === 1 ? 300 : 20 + (index / (pulse.length - 1)) * 560;
    const y = 160 - (item.value / pulseMax) * 130;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pulseLine = `M${pulsePoints.join(' L')}`;
  const pulseArea = `${pulseLine} L580,168 L20,168 Z`;

  const topPages = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((event) => counts.set(event.path, (counts.get(event.path) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [filtered]);

  const eventMix = useMemo(() => {
    const names: TrackingEvent['name'][] = ['page_view', 'session_heartbeat', 'media_progress', 'media_start', 'cta_click', 'apk_download', 'search'];
    return names.map((name) => ({ name: name.replace('_', ' '), value: filtered.filter((event) => event.name === name).length }));
  }, [filtered]);

  const devices = useMemo(() => {
    const names: TrackingEvent['device'][] = ['desktop', 'mobile', 'tablet'];
    return names.map((name) => ({ name, value: filtered.filter((event) => event.device === name).length }));
  }, [filtered]);

  const siteCounts = useMemo(() => ({
    main: filtered.filter((event) => event.site === 'main').length,
    launch: filtered.filter((event) => event.site === 'launch').length,
  }), [filtered]);

  const latestTs = useMemo(() => (
    filtered.length ? Math.max(...filtered.map((event) => event.timestamp)) : null
  ), [filtered]);

  interface WatchedTitle {
    key: string;
    kind: 'movie' | 'tv';
    id: number;
    views: number;
    watchMs: number;
    torrents: number;
  }

  const mostWatched = useMemo(() => {
    const map = new Map<string, WatchedTitle>();
    filtered.forEach((event) => {
      const match = event.path.split('?')[0].match(/^\/(movie|tv)\/(\d+)/);
      if (!match) return;
      const kind = match[1] as 'movie' | 'tv';
      const id = Number(match[2]);
      const key = `${kind}-${id}`;
      const entry = map.get(key) || { key, kind, id, views: 0, watchMs: 0, torrents: 0 };
      if (event.name === 'page_view' || event.name === 'media_view' || event.name === 'media_start') entry.views += 1;
      if (event.name === 'cta_click' && event.label === 'play') entry.views += 1;
      if (event.name === 'media_progress' || event.name === 'media_end') entry.watchMs += event.durationMs || 0;
      if (event.name === 'cta_click' && (event.label || '').startsWith('torrent')) entry.torrents += 1;
      map.set(key, entry);
    });
    return [...map.values()]
      .sort((a, b) => (b.views + b.watchMs / 60000 + b.torrents * 2) - (a.views + a.watchMs / 60000 + a.torrents * 2))
      .slice(0, 5);
  }, [filtered]);

  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    const missing = mostWatched.filter((item) => !titles[item.key]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of missing) {
        try {
          if (item.kind === 'movie') {
            const details = await getMovieDetails(item.id);
            next[item.key] = details.title || `Movie #${item.id}`;
          } else {
            const details = await getTVDetails(item.id);
            next[item.key] = details.name || `Series #${item.id}`;
          }
        } catch {
          next[item.key] = `${item.kind === 'movie' ? 'Movie' : 'Series'} #${item.id}`;
        }
      }
      if (!cancelled) setTitles((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [mostWatched, titles]);

  const jumpTo = (id: string): void => {
    setActiveSection(id);
    document.getElementById(`signal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const nav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'traffic', label: 'Traffic', icon: BarChart3 },
    { id: 'surfaces', label: 'Surfaces', icon: Globe2 },
    { id: 'titles', label: 'Titles', icon: Clapperboard },
    { id: 'events', label: 'Events', icon: Activity },
  ];

  if (authLoading) {
    return (
      <div className="signal-shell" data-signal-theme={theme}>
        <main className="signal-main">
          <div className="signal-card signal-list-card" role="status">
            <div className="signal-card-heading"><div><h3>Checking access</h3><p>Verifying your sign-in.</p></div><Lock size={18} color="var(--signal-accent)" /></div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="signal-shell" data-signal-theme={theme}>
        <main className="signal-main">
          <section className="signal-heading"><div className="signal-eyebrow">Cine-verse / Signalroom</div><h1>See the signal.</h1></section>
          <div className="signal-card signal-list-card">
            <div className="signal-card-heading"><div><h3>Sign-in required</h3><p>This dashboard is private. Sign in with your admin Google account to continue.</p></div><Lock size={18} color="var(--signal-accent)" /></div>
            <div className="signal-list">
              <button className="signal-action" type="button" onClick={() => void signInWithGoogle()}><UserRound size={14} /><span>Sign in with Google</span></button>
            </div>
          </div>
          {authError && <div className="signal-auth-error" role="status">{authError}</div>}
        </main>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="signal-shell" data-signal-theme={theme}>
        <main className="signal-main">
          <section className="signal-heading"><div className="signal-eyebrow">Cine-verse / Signalroom</div><h1>See the signal.</h1></section>
          <div className="signal-card signal-list-card">
            <div className="signal-card-heading"><div><h3>Access denied</h3><p>Signed in as {user.email || 'unknown'}. This dashboard is restricted to the site owner.</p></div><ShieldAlert size={18} color="var(--signal-accent)" /></div>
            <div className="signal-list">
              <button className="signal-action" type="button" onClick={() => void logOut()}><UserRound size={14} /><span>Sign out</span></button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="signal-shell" data-signal-theme={theme}>
      <div className="signal-layout">
        <aside className="signal-rail" aria-label="Dashboard navigation">
          <a className="signal-mark" href="#signal-overview" aria-label="Signalroom home">S</a>
          <div className="signal-rail-group">
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} className="signal-icon-button" data-active={activeSection === id} type="button" title={label} aria-label={label} onClick={() => jumpTo(id)}>
                <Icon size={17} strokeWidth={1.8} />
              </button>
            ))}
          </div>
          <button className="signal-icon-button" type="button" title={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
          </button>
        </aside>

        <main className="signal-main">
          <header className="signal-topbar">
            <span className="signal-live" title={sourceError || undefined}>{source === 'loading' ? 'Syncing' : source === 'live' ? `Firebase live · admin · ${filtered.length} signals` : source === 'fallback' ? 'Firebase blocked — see error below' : 'Waiting for Firebase'}</span>
            <div className="signal-topbar-actions">
              {user ? (
                <button className="signal-profile" type="button" title="Sign out" onClick={() => void logOut()}>
                  {user.photoURL ? <img src={user.photoURL} alt="" /> : <UserRound size={15} />}
                  <span>{user.displayName || user.email || 'Profile'}</span>
                </button>
              ) : (
                <button className="signal-action signal-auth-action" type="button" title="Sign in to read Firebase telemetry" onClick={() => void signInWithGoogle()} disabled={authLoading}>
                  <UserRound size={14} /><span>{authLoading ? 'Connecting' : 'Sign in'}</span>
                </button>
              )}
              <button className="signal-action signal-theme-action" type="button" title="Toggle dashboard theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
              <a className="signal-action" href="/" title="Open Cine-verse"><ExternalLink size={14} /><span>Site</span></a>
              <button className="signal-action" type="button" title="Export filtered events" onClick={() => downloadCsv(filtered)}><FileDown size={14} /><span>Export</span></button>
              <button className="signal-action" type="button" title="Refresh data" onClick={() => void refresh()}><RefreshCw size={14} className={source === 'loading' ? 'animate-spin' : ''} /><span>Refresh</span></button>
            </div>
          </header>
          {authError && <div className="signal-auth-error" role="status">{authError}</div>}
          {source === 'fallback' && sourceError && (
            <div className="signal-auth-error" role="alert">
              Firebase read failed: {sourceError}. Check your connection and database rules, then press Refresh.
            </div>
          )}

          <section className="signal-heading" id="signal-overview">
            <div className="signal-eyebrow">Cine-verse / Signalroom</div>
            <h1>See the signal.</h1>
            <p>Private admin view. Live Firebase telemetry for both surfaces.</p>
          </section>

          <motion.section className="signal-hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="signal-hero-copy">
              <div className="signal-eyebrow">{range} day window / {site === 'all' ? 'all surfaces' : site}</div>
              <h2>Follow the pulse.</h2>
              <p>Updated {formatTime(lastUpdated)} · {filtered.length} captured signals · {sessions} total sessions, {activeNow} online now{latestTs ? ` · newest signal ${relativeTime(latestTs)} ago` : ' · no signals yet'}</p>
            </div>
            <div className="signal-health-stage" aria-label="Live session health monitor">
              <div className="signal-health-top"><span>Heartometer · users per 5 min · last hour</span><span className={heartbeatLive ? 'signal-health-status is-live' : 'signal-health-status'}>{heartbeatLive ? `${activeNow} online` : 'Awaiting pulse'}</span></div>
              <div className="signal-ecg-wrap">
                <svg viewBox="0 0 600 180" role="img" aria-label={`Active users per 5 minutes over the last hour, peak ${pulseMax}`}>
                  <path className="signal-ecg-grid" d="M0 30H600M0 90H600M0 150H600" />
                  <text className="signal-pulse-axis" x="6" y="26">{pulseMax}</text>
                  <text className="signal-pulse-axis" x="6" y="86">{Math.round(pulseMax / 2)}</text>
                  <text className="signal-pulse-axis" x="6" y="146">0 users</text>
                  <path className="signal-pulse-area" d={pulseArea} />
                  <polyline className="signal-pulse-line" points={pulsePoints.join(' ')} />
                  {pulse.map((item, index) => {
                    const x = 20 + (index / (pulse.length - 1)) * 560;
                    const y = 160 - (item.value / pulseMax) * 130;
                    return (
                      <g key={`${item.label}-${index}`}>
                        <circle className="signal-pulse-dot" cx={x} cy={y} r={item.value > 0 ? 4 : 2.5} />
                        <title>{`${item.label}: ${item.value} users`}</title>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="signal-health-readout">
                <div><span>State</span><strong>{heartbeatLive ? 'LIVE' : 'IDLE'}</strong></div>
                <div><span>Online now (5 min)</span><strong>{formatNumber(activeNow)}</strong></div>
                <div><span>Session beats</span><strong>{formatNumber(heartbeatEvents)}</strong></div>
              </div>
            </div>
          </motion.section>

          <div className="signal-section-label"><span>At a glance</span><span>{site === 'all' ? 'Main + launch' : site}</span></div>
          <section className="signal-grid-5" aria-label="Key metrics">
            {[
              { label: 'Page views', value: formatNumber(pageViews), note: `${viewDelta >= 0 ? '+' : ''}${viewDelta}% vs prior window`, icon: MousePointer2 },
              { label: 'Sessions', value: formatNumber(sessions), note: `${formatNumber(activeNow)} online now · ${formatDuration(averageSessionMs)} avg`, icon: Users },
              { label: 'Active app', value: formatDuration(activeAppMs), note: 'visible session time', icon: Clock3 },
              { label: 'Watch time', value: formatDuration(watchMs), note: 'native player time', icon: Activity },
              { label: 'APK releases', value: githubDownloads === null ? '—' : formatNumber(githubDownloads), note: 'GitHub asset downloads', icon: Download },
            ].map(({ label, value, note, icon: Icon }, index) => (
              <motion.div key={label} className="signal-card signal-metric" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.35 }} whileHover={{ y: -5, rotateX: 2, rotateY: index % 2 ? -1 : 1 }}>
                <div className="signal-metric-top"><span>{label}</span><Icon size={15} /></div>
                <div className="signal-metric-value">{value}</div>
                <div className="signal-metric-note">{note}</div>
              </motion.div>
            ))}
          </section>

          <section className="signal-section" id="signal-traffic">
            <div className="signal-section-label"><span>Traffic pulse</span><span>14 days</span></div>
            <div className="signal-grid-2">
              <div className="signal-card signal-chart-card">
                <div className="signal-card-heading"><div><h3>Page views over time</h3><p>Daily page_view events</p></div><BarChart3 size={18} color="var(--signal-accent)" /></div>
                <div className="signal-chart" aria-label="Page views histogram">
                  <div className="signal-chart-grid" aria-hidden="true">{[0, 1, 2, 3].map((line) => <span key={line} />)}</div>
                  <div className="signal-bars">
                    {chart.map((item, index) => <div className="signal-bar-wrap" key={`${item.label}-${index}`} title={`${item.value} views`}><div className="signal-bar-area"><div className="signal-bar" style={{ height: `${Math.max(item.value ? 7 : 2, (item.value / chartMax) * 100)}%` }} /></div><div className="signal-bar-label">{index % 2 === 0 ? item.label : ''}</div></div>)}
                  </div>
                </div>
              </div>
              <div className="signal-card signal-list-card">
                <div className="signal-card-heading"><div><h3>Event mix</h3><p>What people did</p></div><Activity size={18} color="var(--signal-accent-2)" /></div>
                <div className="signal-list">{eventMix.map((item) => <div className="signal-list-row" key={item.name}><span>{item.name}</span><strong>{formatNumber(item.value)}</strong></div>)}</div>
              </div>
            </div>
          </section>

          <section className="signal-section" id="signal-surfaces">
            <div className="signal-section-label"><span>Surface split</span><span>Tracked events</span></div>
            <div className="signal-grid-2">
              <div className="signal-card signal-list-card">
                <div className="signal-card-heading"><div><h3>Where people land</h3><p>Main app and launch surface</p></div><Globe2 size={18} color="var(--signal-accent)" /></div>
                <div className="signal-list">
                  {(['main', 'launch'] as const).map((name) => { const value = siteCounts[name]; const total = Math.max(1, siteCounts.main + siteCounts.launch); return <div className="signal-list-row" key={name}><span>{name}</span><div className="signal-track"><i style={{ width: `${(value / total) * 100}%` }} /></div><strong>{formatNumber(value)}</strong></div>; })}
                </div>
              </div>
              <div className="signal-card signal-list-card">
                <div className="signal-card-heading"><div><h3>Devices</h3><p>Observed session shape</p></div><Monitor size={18} color="var(--signal-accent-2)" /></div>
                <div className="signal-list">{devices.map((item) => { const Icon = item.name === 'mobile' ? Smartphone : item.name === 'tablet' ? Tablet : Monitor; return <div className="signal-list-row" key={item.name}><span className="flex items-center gap-2"><Icon size={14} />{item.name}</span><strong>{formatNumber(item.value)}</strong></div>; })}</div>
              </div>
            </div>
          </section>

          <section className="signal-section" id="signal-titles">
            <div className="signal-section-label"><span>Most watched</span><span>titles in window</span></div>
            <div className="signal-card signal-list-card">
              <div className="signal-card-heading"><div><h3>Top titles</h3><p>Visits, native watch time and torrent taps per movie or series.</p></div><Clapperboard size={18} color="var(--signal-accent)" /></div>
              {mostWatched.length ? (
                <div className="signal-list">
                  {mostWatched.map((item) => (
                    <div className="signal-list-row" key={item.key}>
                      <span className="max-w-[220px] truncate">{titles[item.key] || `${item.kind === 'movie' ? 'Movie' : 'Series'} #${item.id}`}</span>
                      <span>{item.kind === 'movie' ? 'film' : 'series'} · {formatNumber(item.views)} visits · {formatDuration(item.watchMs)} watched · {formatNumber(item.torrents)} torrent taps</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="signal-empty">No title activity in this window. Open a movie on any device and press Refresh.</div>
              )}
            </div>
          </section>

          <section className="signal-section" id="signal-events">
            <div className="signal-section-label"><span>Recent stream</span><span>{filtered.length} signals</span></div>
            <div className="signal-feed">
              <div className="signal-card signal-list-card">
                <div className="signal-card-heading"><div><h3>Latest events</h3><p>Names and raw query text stay out of telemetry.</p></div><Database size={18} color="var(--signal-accent)" /></div>
                {filtered.length ? <div>{filtered.slice(-6).reverse().map((event) => <div className="signal-feed-row" key={event.id}><span className="signal-feed-dot" /><span className="signal-feed-main">{event.name} · {event.site}{event.label ? ` · ${event.label}` : ''}{event.durationMs ? ` · ${formatDuration(event.durationMs)}` : ''}</span><span className="signal-feed-meta">{relativeTime(event.timestamp)}</span></div>)}</div> : <div className="signal-empty">No signals in this window.</div>}
              </div>
              <div className="signal-card signal-list-card">
                <div className="signal-card-heading"><div><h3>Top paths</h3><p>Most active routes</p></div><Search size={18} color="var(--signal-accent-2)" /></div>
                {topPages.length ? <div className="signal-list">{topPages.map(([path, count]) => <div className="signal-list-row" key={path}><span className="max-w-[170px] truncate">{path}</span><strong>{formatNumber(count)}</strong></div>)}</div> : <div className="signal-empty">No paths yet.</div>}
              </div>
            </div>
          </section>

          <div className="signal-footnote">
            <span>Window</span>
            <select aria-label="Time window" value={range} onChange={(event) => setRange(Number(event.target.value) as Range)} className="ml-2 rounded-md border border-white/10 bg-transparent px-2 py-1 text-[0.65rem] text-inherit"><option value={7}>7 days</option><option value={30}>30 days</option></select>
            <span className="mx-2">·</span>
            <select aria-label="Surface" value={site} onChange={(event) => setSite(event.target.value as SiteFilter)} className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-[0.65rem] text-inherit"><option value="all">All surfaces</option><option value="main">Main</option><option value="launch">Launch</option></select>
            <span className="float-right">Admin: {user.email} · auto-refresh 15s{latestTs ? ` · newest ${relativeTime(latestTs)} ago` : ''}</span>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
