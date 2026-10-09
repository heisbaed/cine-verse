# Cine-verse scraper-service

Cloudflare Worker that keeps stream-source maintenance out of the Android TV APK. The TV sends canonical TMDB IDs; the service returns direct HTTPS MP4/HLS records and any required playback headers. Playback stays inside native Media3.

## Local development

```bash
npm install
npm run typecheck
npm test
npm run dev
```

The app does not substitute sample clips for catalog content. An empty response means no configured provider returned a stream.


## Production setup

1. This repository does not include a movie or TV stream provider. Configure an API you are authorized to use that returns direct HTTPS MP4/HLS playback URLs; a TMDB key or a free Worker account cannot supply video. Keep provider-specific request and parsing code inside `src/adapters/upstreamA.ts`.
2. Store secrets with `npx wrangler secret put UPSTREAM_A_TOKEN`. Never add tokens to `wrangler.toml` or logs.
3. Set `UPSTREAM_A_URL` as a Worker variable, run `npm test`, then `npm run deploy`.
4. Put the deployed HTTPS URL in `android-tv/local.properties` as `SCRAPER_BASE=https://...` before building, or enter it in TV Settings.

Responses are cached in memory for 30 minutes. Each adapter has a 15-second timeout. `/version` reports `unconfigured` until `UPSTREAM_A_URL` is set; this only confirms configuration, not that a title will resolve or play. `/health` provides a lightweight deployment check.

## Weekly maintenance runbook

- Mark a failing adapter immediately: set `BROKEN_SOURCES=A,B` in the Worker environment and redeploy. TVs will disable those rows and show “Source under maintenance.”
- Fix one adapter at a time inside `src/adapters/`, add a fixture for the changed parser, run typecheck/tests, bump `SERVICE_VERSION`, and deploy.
- Add a source by implementing the `Adapter` interface and registering it in `src/index.ts`. Validate direct URLs as HTTPS and forward only the allowlisted playback headers.
- Remove the adapter ID from `BROKEN_SOURCES` after `/stream` and real TV playback pass.
- To force TV clients to recheck, bump `SERVICE_VERSION`. The TV refreshes status whenever the picker or Settings test opens.

Firebase Remote Config keys planned for production are `scraper_base`, `min_service_version`, `broken_sources`, and `tv_rollout_pct`. Until the Android Firebase app credentials and deployed Worker URL exist, the Settings override and `/version` health response are the truthful configuration path; do not pretend Remote Config is active.

## API

- `GET /health`
- `GET /version`
- `GET /stream/movie/:tmdbId?exclude=A`
- `GET /stream/tv/:tmdbId/:season/:episode?exclude=A`

The stream endpoints return `{ "streams": [{ "url", "headers", "quality", "subtitles", "source", "expiresAt" }] }`. The array supports the TV quality/source picker while keeping each record compatible with the single-stream contract.
