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
| Routing | react-router-dom v7 | 7 routes — `/`, `/explore`, `/upcoming`, `/global`, `/watchlist`, `/movie/:id`, `*` (404) |
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
| Upcoming | `/upcoming` | Grouped by month, countdown badges, timeline + grid views |
| Global | `/global` | 14 region tabs (en, hi, yo, sw, af, ko, ja, zh, fr, de, es, ar, tr, it) |
| Watchlist | `/watchlist` | Persisted via Zustand + localStorage, grid layout, empty state |
| 404 | `*` | Cinematic error page with home link |

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
