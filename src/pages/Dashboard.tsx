import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, BarChart3, Clock3, Download, FileDown, Film, Globe2, Lock, LogOut, Moon, Play, RefreshCw, Search, Smartphone, Sun, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMovieDetails, getTVDetails } from '@/api/tmdb';
import { buildAnalytics, periodBounds, SURFACE_LABELS, type SurfaceFilter, type TitleMetric } from '@/lib/analytics';
import { emptySnapshot, subscribeAnalytics } from '@/lib/liveAnalytics';
import type { TrackingEvent } from '@/lib/siteTracking';

const ADMINS = ((import.meta.env.VITE_DASHBOARD_ADMINS as string | undefined) || 'charlesbabuu0@gmail.com').split(',').map((v) => v.trim().toLowerCase());
const number = (value: number) => new Intl.NumberFormat('en-US').format(value);
const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;
};
const ago = (timestamp: number | null, now: number) => {
  if (timestamp === null) return 'No events received';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
};
const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function exportCsv(events: Array<TrackingEvent & { surface: string }>) {
  const rows = events.map((e) => [new Date(e.timestamp).toISOString(), e.name, e.surface, e.path, e.label || '', e.sessionId, e.device, e.durationMs ?? '']);
  const escape = (value: unknown) => `"${String(value).replace(/^[=+@\-]/, "'$&").replace(/"/g, '""')}"`;
  const blob = new Blob([['timestamp,event,platform,path,label,session,device,duration_ms', ...rows.map((row) => row.map(escape).join(','))].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `cineverse-analytics-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TitleName({ item }: { item: TitleMetric }) {
  const query = useQuery({
    queryKey: ['analytics-title', item.kind, item.id],
    queryFn: async () => item.kind === 'movie' ? (await getMovieDetails(item.id)).title : (await getTVDetails(item.id)).name,
    staleTime: 24 * 60 * 60 * 1000, retry: 1,
  });
  return <a href={`/${item.kind}/${item.id}`} target="_blank" rel="noopener noreferrer">{query.data || `${item.kind === 'movie' ? 'Movie' : 'Series'} #${item.id}`}<ArrowUpRight size={12} /></a>;
}

async function getReleaseDownloads(): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/heisbaed/cine-verse/releases?per_page=100&page=${page}`);
    if (!response.ok) throw new Error('GitHub download totals are temporarily unavailable');
    const releases = await response.json() as Array<{ assets: Array<{ name: string; download_count: number }> }>;
    for (const release of releases) for (const asset of release.assets) if (asset.name.endsWith('.apk')) total += asset.download_count;
    if (releases.length < 100) return total;
  }
  throw new Error('Release history exceeds the available download window');
}

export default function Dashboard() {
  const { user, authLoading, authError, signInWithGoogle, logOut } = useAuth();
  const authorized = !!user?.email && ADMINS.includes(user.email.toLowerCase());
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return localStorage.getItem('cine-verse-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } });
  const [days, setDays] = useState(7);
  const [surface, setSurface] = useState<SurfaceFilter>('all');
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [clock, setClock] = useState(Date.now());
  const [revision, setRevision] = useState(0);
  const [showHeartbeats, setShowHeartbeats] = useState(false);
  const now = clock + snapshot.serverOffset;
  const since = periodBounds(now, days).previousStart;
  useEffect(() => { try { localStorage.setItem('cine-verse-theme', theme); } catch { /* Theme works without storage. */ } }, [theme]);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 10_000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, []);
  useEffect(() => {
    if (!authorized) { setSnapshot(emptySnapshot()); return; }
    return subscribeAnalytics(since, setSnapshot);
  }, [authorized, user?.uid, since, revision]);
  const data = useMemo(() => buildAnalytics(snapshot.events, now, days, surface), [snapshot.events, now, days, surface]);
  const releases = useQuery({ queryKey: ['analytics-release-downloads'], queryFn: getReleaseDownloads, enabled: authorized, refetchInterval: 5 * 60_000, staleTime: 60_000, retry: 1 });
  const feeds = Object.entries(snapshot.feeds);
  const ready = authorized && feeds.some(([, feed]) => feed.ready);
  const partial = feeds.some(([, feed]) => !feed.ready || feed.error);
  const capped = feeds.some(([, feed]) => feed.capped);
  const status = !ready ? (feeds.some(([, feed]) => feed.error) ? 'Connection failed' : 'Connecting') : !snapshot.connected ? 'Offline · saved view' : partial ? 'Partial data' : 'Live';
  const metric = (value: number) => ready ? number(value) : '—';
  const measured = (value: number, available: boolean) => ready && available ? duration(value) : '—';
  const stream = data.current.filter((event) => showHeartbeats || !event.name.startsWith('session_')).slice(-25).reverse();
  const chartMax = Math.max(1, ...data.chart.map((day) => day.views));
  const pulseMax = Math.max(1, ...data.pulse.map((point) => point.value));
  const pulseLine = data.pulse.map((point, index) => `${index === 0 ? 'M' : 'L'}${44 + index / 29 * 650},${154 - point.value / pulseMax * 124}`).join(' ');
  const surfaces = ['android', 'ios', 'web', 'launch', 'native', 'unknown'] as const;

  if (!authorized) return <div className="signal-shell" data-signal-theme={theme}><main className="analytics-gate">
    <div className="analytics-brand"><BarChart3 size={22} /> CINEVERSE <span>ANALYTICS</span></div>
    <section className="signal-card"><Lock size={28} /><h1>{authLoading ? 'Checking access' : user ? 'Admin access required' : 'Your audience, in focus.'}</h1>
      <p>{authLoading ? 'Verifying your account.' : user ? 'This account cannot read the analytics dashboard.' : 'Sign in with your admin account to view website and mobile activity.'}</p>
      {!authLoading && <button className="signal-action" onClick={() => void (user ? logOut() : signInWithGoogle())}>{user ? 'Sign out' : 'Sign in with Google'}</button>}
      {authError && <p role="alert">{authError}</p>}
    </section>
  </main></div>;

  return <div className="signal-shell analytics-shell" data-signal-theme={theme}>
    <header className="analytics-topbar">
      <a href="/dashboard" className="analytics-brand"><BarChart3 size={22} /> CINEVERSE <span>ANALYTICS</span></a>
      <nav aria-label="Analytics sections"><a href="#overview">Overview</a><a href="#platforms">Platforms</a><a href="#titles">Titles</a><a href="#events">Activity</a></nav>
      <div className="analytics-account"><button className="signal-icon-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <span>{user?.displayName || user?.email}</span><button className="signal-icon-button" aria-label="Sign out" onClick={() => void logOut()}><LogOut size={17} /></button></div>
    </header>
    <main className="analytics-main">
      <section className="analytics-heading" id="overview"><div><div className="analytics-kicker">Audience overview</div><h1>Every screen. One view.</h1><p>Website and app activity, measured as it happens.</p></div>
        <div className="analytics-status" data-live={status === 'Live'} role="status"><span />{status}<small>Latest activity: {ago(data.latest, now)}</small></div>
      </section>
      <div className="analytics-toolbar">
        <div className="analytics-filters"><label>Platform<select value={surface} onChange={(event) => setSurface(event.target.value as SurfaceFilter)}>{(['all', ...surfaces] as const).map((key) => <option key={key} value={key}>{SURFACE_LABELS[key]}</option>)}</select></label>
          <label>Period<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label></div>
        <div className="analytics-actions"><button className="signal-action" onClick={() => { setRevision((v) => v + 1); void releases.refetch(); }}><RefreshCw size={14} />Reconnect</button><button className="signal-action" disabled={!ready || !data.current.length} onClick={() => exportCsv(data.current)}><FileDown size={14} />Export</button></div>
      </div>
      {(!snapshot.connected || partial || capped) && <div className="analytics-notice" role="status">{!ready ? 'Waiting for analytics. Values stay blank until data arrives.' : !snapshot.connected ? 'Connection interrupted. Showing the last received data; reconnection is automatic.' : partial ? 'One data source is unavailable. Totals include only the sources received.' : ''}{capped ? ' This period reached the 50,000-event limit for a source. Totals are partial; select a shorter period.' : ''}{feeds.filter(([, feed]) => feed.error).map(([name, feed]) => <div key={name}>{name}: {feed.error}</div>)}</div>}
      <section className="analytics-metrics" aria-label="Audience metrics">
        {[
          { label: 'Active now', value: metric(data.activeNow), note: 'Sessions seen in the last 90 seconds', Icon: Activity },
          { label: 'Sessions', value: metric(data.sessions), note: 'Distinct sessions, not individual people', Icon: Users },
          { label: 'Page & screen views', value: metric(data.views), note: data.previousViews ? `${((data.views - data.previousViews) / data.previousViews * 100).toFixed(0)}% vs previous ${days} days` : 'No previous-period views to compare', Icon: Globe2 },
          { label: 'Active time', value: measured(data.activeMs, data.hasDuration), note: data.hasDuration ? `${duration(data.averageSessionMs)} average per session` : 'Waiting for session duration events', Icon: Clock3 },
        ].map(({ label, value, note, Icon }) => <article className="signal-card analytics-metric" key={label}><div><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><p>{note}</p></article>)}
      </section>
      <div className="analytics-charts">
        <section className="signal-card analytics-panel"><div className="analytics-panel-head"><div><h2>Live audience</h2><p>Active sessions · last 30 minutes · 90-second presence window</p></div><Activity size={18} /></div>
          <svg className="analytics-pulse" viewBox="0 0 720 190" role="img" aria-label={`Active sessions over the last 30 minutes. Currently ${data.activeNow}.`}>
            {[0, 0.5, 1].map((ratio) => <g key={ratio}><line x1="44" x2="694" y1={154 - ratio * 124} y2={154 - ratio * 124} stroke="var(--signal-line)" /><text x="32" y={158 - ratio * 124} textAnchor="end">{Number((pulseMax * ratio).toFixed(1))}</text></g>)}
            {ready && <path d={pulseLine} fill="none" stroke="var(--signal-accent)" strokeWidth="2.5" />}
            {[0, 14, 29].map((index) => <text key={index} x={44 + index / 29 * 650} y="179" textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'}>{time(data.pulse[index].timestamp)}</text>)}
          </svg>
        </section>
        <section className="signal-card analytics-panel"><div className="analytics-panel-head"><div><h2>Views over time</h2><p>{days === 1 ? 'Today' : `${days} calendar days`} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p></div><BarChart3 size={18} /></div>
          <div className="analytics-bars" aria-label="Daily page and screen views">{data.chart.map((day) => <div key={day.timestamp} title={`${new Date(day.timestamp).toLocaleDateString()}: ${day.views} views, ${day.sessions} sessions`}><strong>{ready ? day.views : '—'}</strong><div><i style={{ height: `${day.views / chartMax * 100}%` }} /></div><small>{new Date(day.timestamp).getDate()}</small></div>)}</div>
        </section>
      </div>
      <section id="platforms" className="analytics-section"><div className="analytics-section-heading"><div><h2>Platform health</h2><p>All platforms in this period. Select a card to inspect its activity.</p></div><Smartphone size={20} /></div>
        <div className="analytics-platforms">{surfaces.filter((key) => ['android', 'web', 'launch'].includes(key) || data.surfaces.some((s) => s.name === key)).map((key) => {
          const entry = data.surfaces.find((s) => s.name === key);
          return <button key={key} className="signal-card analytics-platform" data-selected={surface === key} onClick={() => setSurface(surface === key ? 'all' : key)}><span>{SURFACE_LABELS[key]}<ArrowUpRight size={15} /></span><strong>{ready ? number(entry?.sessions || 0) : '—'} <small>sessions</small></strong><p>{entry ? `${number(entry.events)} events · ${ago(entry.latest, now)}` : 'No events received in this period'}</p>{key === 'native' && <small>Legacy app events without OS metadata</small>}{key === 'unknown' && <small>Older events without a platform marker</small>}</button>;
        })}</div>
      </section>
      <section className="analytics-section"><div className="analytics-section-heading"><div><h2>Engagement</h2><p>{SURFACE_LABELS[surface]} · selected period</p></div><Play size={20} /></div>
        <div className="analytics-metrics">{[
          { label: 'Player opens', value: metric(data.opens), note: 'Recorded player starts' },
          { label: 'Player-open time', value: measured(data.playerOpenMs, data.hasPlayerOpen), note: 'Embedded player visible; playback is not observable' },
          { label: 'Measured playback', value: measured(data.playbackMs, data.hasPlayback), note: data.hasPlayback ? 'Playback reported by a supported player' : 'Not reported by embedded players' },
          { label: 'Searches', value: metric(data.searches), note: 'Search actions; query text is not stored' },
        ].map((item) => <article className="signal-card analytics-metric" key={item.label}><div><span>{item.label}</span></div><strong>{item.value}</strong><p>{item.note}</p></article>)}</div>
      </section>
      <section id="titles" className="signal-card analytics-panel analytics-section"><div className="analytics-panel-head"><div><h2>Top titles</h2><p>Ranked by visits. Opens and clicks are counted separately.</p></div><Film size={20} /></div>
        {data.titles.length ? <div className="analytics-table-wrap"><table><thead><tr><th>Title</th><th>Visits</th><th>Player opens</th><th>Torrent actions</th><th>Player-open time</th><th>Playback</th></tr></thead><tbody>{data.titles.map((item) => <tr key={item.key}><td><TitleName item={item} /><small>{item.kind === 'movie' ? 'Movie' : 'Series'}</small></td><td>{number(item.visits)}</td><td>{number(item.opens)}</td><td>{number(item.torrents)}</td><td>{item.playerOpenMs ? duration(item.playerOpenMs) : '—'}</td><td>{item.playbackMs ? duration(item.playbackMs) : '—'}</td></tr>)}</tbody></table></div> : <div className="analytics-empty">{ready ? 'No title events in this period. Visits appear here when a tracked device opens a title.' : 'Waiting for title activity…'}</div>}
      </section>
      <div className="analytics-charts analytics-section">
        <section className="signal-card analytics-panel"><div className="analytics-panel-head"><div><h2>Top pages & screens</h2><p>Views only; heartbeats do not inflate these counts.</p></div><Search size={18} /></div>{data.paths.length ? data.paths.map(([path, count]) => <div className="analytics-row" key={path}><span>{path}</span><strong>{number(count)}</strong></div>) : <div className="analytics-empty">No page or screen views received.</div>}</section>
        <section className="signal-card analytics-panel"><div className="analytics-panel-head"><div><h2>App distribution</h2><p>Downloads are separate from app usage.</p></div><Download size={18} /></div><div className="analytics-row"><span>Download button clicks <small>Selected period & platform</small></span><strong>{metric(data.downloadClicks)}</strong></div><div className="analytics-row"><span>APK downloads on GitHub <small>All releases · lifetime · refreshes every 5 minutes</small></span><strong>{releases.data === undefined ? '—' : number(releases.data)}</strong></div>{releases.isError && <p className="analytics-note">{releases.data === undefined ? 'GitHub is unavailable. Download count is unknown.' : 'Showing the last GitHub total; refresh failed.'}</p>}</section>
      </div>
      <section id="events" className="signal-card analytics-panel analytics-section"><div className="analytics-panel-head"><div><h2>Live activity</h2><p>Latest 25 events for {SURFACE_LABELS[surface].toLowerCase()}.</p></div><label className="analytics-checkbox"><input type="checkbox" checked={showHeartbeats} onChange={(event) => setShowHeartbeats(event.target.checked)} />Include sessions</label></div>
        {stream.length ? <div className="analytics-table-wrap"><table><thead><tr><th>Event</th><th>Platform</th><th>Page / screen</th><th>Detail</th><th>Received</th></tr></thead><tbody>{stream.map((event) => <tr key={`${event.site}:${event.id}`}><td>{event.name.replace(/_/g, ' ')}</td><td><span className="analytics-badge">{SURFACE_LABELS[event.surface]}</span></td><td>{event.path}</td><td>{event.label || '—'}{event.durationMs ? ` · ${duration(event.durationMs)}` : ''}</td><td title={new Date(event.timestamp).toLocaleString()}>{ago(event.timestamp, now)}</td></tr>)}</tbody></table></div> : <div className="analytics-empty">{showHeartbeats ? 'No events received for this selection.' : 'No interactions yet. Enable sessions to see connections and heartbeats.'}</div>}
      </section>
      <footer className="analytics-footer"><span>Firebase Realtime Database · {number(data.current.length)} events in view · dashboard activity excluded</span><span>Sessions identify visits, not people. Unavailable measurements show —.</span></footer>
    </main>
  </div>;
}
