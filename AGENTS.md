# Cine-verse

React + Vite + TypeScript movie encyclopedia powered by TMDB.

## Quick start

```bash
npm install
npm run dev      # dev server on 0.0.0.0
npm run build    # production build
npm run preview  # preview build on 0.0.0.0
```

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Routing | react-router-dom v7 | 10 routes — `/`, `/explore`, `/upcoming`, `/global`, `/watchlist`, `/movie/:id`, `/tv/:id`, `/download`, `/dashboard`, `*` (404) |
| Data fetching | TanStack React Query | `staleTime: 5min`, `refetchOnWindowFocus: false`, `retry: 2` |
| State | Zustand + persist | Watchlist in localStorage key `cine-verse-watchlist` |
| Animations | framer-motion | Hero carousel, cards, staggered reveals, page transitions |
| Icons | lucide-react | Entirely icon-driven UI |
| Styling | Tailwind CSS v4 | Colors defined in `src/index.css` via `@theme` |
| HTTP | Axios | TMDB API client in `src/api/tmdb.ts` |

## Path alias

`@/` maps to `./src/` (configured in `vite.config.ts` and `tsconfig.json`).

## Tailwind v4 details

- No `tailwind.config.js` — colors and fonts are set in `src/index.css` via `@theme`
- Custom colors: `background` (#09090B), `surface` (#121218), `gold`, `ruby`, `electric`, `emerald`
- Utility classes `scrollbar-hide`, `line-clamp-2`, `line-clamp-3` defined with `@utility` in CSS

## TMDB API

- API key via `VITE_TMDB_API_KEY` env var (local `.env` only, never committed)
- `hasApiKey()` returns false if falsy → `SetupScreen` renders on Home, other pages show fallback
- No key files are committed — `.env` is gitignored, there is no `.env.example`
- `getImageUrl(path, size)` handles null paths with a fallback Unsplash image
- All 16 TMDB endpoints in `src/api/tmdb.ts` — trending, popular, top_rated, upcoming, now_playing, details, credits, videos, similar, recommendations, reviews, search, discover, genres, external_ids, watch_providers

## Pages

| Page | Route | Key features |
|---|---|---|
| Home | `/` | Hero carousel (auto-rotate), 5 movie rows (trending, now playing, upcoming, popular, top rated) |
| Explore | `/explore` | Debounced search (500ms), genre/year filters, grid layout |
| MovieDetail | `/movie/:id` | Full details, cast carousel, crew, trailer modal, inline video player, reviews, watch providers, similar/recommended, share button, 5 external links |
| TVDetail | `/tv/:id` | Series details, seasons/episodes, cast, trailers, reviews, similar/recommended |
| Upcoming | `/upcoming` | Grouped by month, countdown badges, timeline + grid views |
| Global | `/global` | 14 region tabs (en, hi, yo, sw, af, ko, ja, zh, fr, de, es, ar, tr, it) |
| Watchlist | `/watchlist` | Persisted via Zustand + localStorage, grid layout, empty state |
| Download | `/download` | Android APK release info + direct GitHub release download (holds navigation ~450ms so `apk_download` flushes to Firebase before the browser leaves) |
| Dashboard | `/dashboard` | Private admin analytics (see Analytics below), excluded from tracking + chrome |
| 404 | `*` | Cinematic error page with home link |

## Analytics (Signalroom dashboard)

- Telemetry lives in `src/lib/siteTracking.ts` (`trackEvent`, `trackPageView`, `startSessionTracking`) → Firebase RTDB `analytics/main|launch/events`
- Web events send `platform: 'web'`, `schemaVersion: 2`, `durationMs` clamped 0–30000, writes use `serverTimestamp()`; `/dashboard` visits are never tracked and `App.tsx` skips session tracking + navbar chrome there
- `src/lib/liveAnalytics.ts` subscribes via `onValue` (`orderByChild('timestamp')`, `startAt`, `limitToLast(50k)`) — no polling; `src/lib/analytics.ts` classifies `surface` (`web|android|ios|native|launch|unknown`) and builds sessions/views/active-time/title metrics; missing measurements render as `—`, never 0-filled
- Dashboard filters: Platform (`all` default — phone-browser visits are `web`, not `android`) × Period (Today / 7 / 30 days); *Download button clicks* = `apk_download` events (instant), *APK downloads on GitHub* = lifetime release-asset totals via GitHub API (5-min cache, not instant); *First launches* = `app_install` pings (one per native version per device); *Backup* exports full-fidelity JSON — keep monthly, feeds cap at 50k events
- Telemetry health (`cineverse-signal-health-v1` in localStorage: sent/failed counts + last error) surfaces on the dashboard's *App distribution* card as *Telemetry health (this device)*
- Reads require admin auth (`VITE_DASHBOARD_ADMINS`, default `charlesbabuu0@gmail.com`); writes are public per `database.rules.json` (timestamp ≤ now, durationMs ≤ 30000)
- Auth uses `authDomain: ourcineverse.web.app` in `src/lib/firebase.ts` — it must match a redirect URI registered on the project's Google OAuth client (`ourcineverse.web.app/__/auth/handler`); switching it to `cine-verse-231ad.firebaseapp.com` causes `400 redirect_uri_mismatch`. Sign-in failures surface the raw `auth/*` code in the UI; popup `internal-error` falls back to full-page redirect
- Phone testing gotcha: site is a PWA — hard-refresh the phone browser after deploys or it runs the stale service-worker bundle
- `registerSW` in `src/main.tsx` polls hourly + fires `cineverse:sw-update-available`; `UpdateBanner` shows a *New version available → Refresh* pill so users leave stale bundles
- SEO: `useSEO` sets title/description + `og:*`/`twitter:*` (image = TMDB poster on detail pages); `public/sitemap.xml` + `public/robots.txt` (dashboard disallowed). JS-rendered meta is invisible to most crawlers — true per-title unfurls need SSR/Functions, not static hosting

## Deploy

- `npm run deploy:staging` — build + deploy `hosting:mainsite` (`ourcineverse.web.app`); `deploy:launch` — alternate site; `deploy:release` — both via `firebase.release.json`, project `cine-verse-231ad`
- Installed v1.2.3 APKs listen on EAS channel `preview` — mobile telemetry fixes must be published there (Android-only: full-platform export fails on missing `react-native-web-webview` via `react-native-youtube-iframe`)

## Components

- **Sections**: `HeroCarousel`, `MovieRow` (horizontal scroll), `MovieGrid` (responsive grid), `CastCarousel`, `CrewSection`, `TrailerSection` (YouTube embed or external link), `TrailerModal` (overlay player), `VideoPlayer` (HLS/MP4 with custom controls), `ReviewsSection`, `WatchProviders` (flatrate/rent/buy), `SetupScreen`
- **UI**: `SkeletonCard`, `SkeletonGrid`, `EmptyState`, `ErrorState` (with retry button)
- **Movie**: `MovieCard` (poster, rating, year, bookmark toggle, stagger animation via `index * 0.03`)
- **Video**: `hls.js` library for HLS streaming — loaded dynamically, adds ~509 KB to build

## Conventions

- **Semicolons + single quotes** throughout
- `noUnusedLocals` and `noUnusedParameters` are strict
- No barrel `index.ts` files — imports point directly to specific files
- `utils/` and `components/ui/` exist but `utils/` is empty
- `autoprefixer` included in PostCSS config but may be unnecessary with Tailwind v4
- `.grain` CSS class adds noise texture overlay (fixed, `z-index: 1`)
- Custom scrollbar styles in `index.css`
- All external links open in new tab with `rel="noopener noreferrer"`
