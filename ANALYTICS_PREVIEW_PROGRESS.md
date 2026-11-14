# Analytics and share previews

## 14 November 2026
- User requested dashboard update and working link previews, then explicitly chose to keep free hosting.
- Dashboard now separates lifetime APK transfers for the public mobile download repository, mobile source releases and Cineverse TV. Shows newest release counts and observed first launches by version, not invented installed-user totals.
- Added media download action counters and title-level queued downloads while preserving legacy torrent counts. Download lifecycle telemetry shipped through preview OTA 22576e02-188c-415c-84a6-179fc71a76ae. These are best-effort reports, not backfilled or guaranteed background completion receipts.
- Playback labeled as reported samples because the current native bridge reports at most 30 seconds on exit. Missing duration is no longer presented as measured zero.
- Fixed companion viewport placement. Populated and empty development admin-surface rendering tested with representative data and blocked production analytics writes. No production admin authentication was performed.
- Free static previews generated from 81 current catalog titles. Standard pages use a 1200x630 PNG rendered from existing brand SVG. Unknown titles still use a generic Cineverse preview. No billing or API plan changed. No fabricated app screenshots used.
- Tests cover analytics deduplication, version counts, platform filtering, release asset selection, HTML escaping and all generated preview metadata. Site build and SEO checks pass. Existing unrelated CineMate TypeScript errors remain; full-site typecheck is not green.
- Deployment and live crawler verification in progress.
