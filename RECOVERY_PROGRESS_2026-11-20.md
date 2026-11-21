# Cineverse recovery work — 20 November 2026

## User scope and delivery state
- Reviewed the saved work in `big_picle_mods.md` (that is the actual filename).
- User requested export, better African/creator discovery, source/quality coverage, web playback/download repair, and downloads surviving app background/screen lock.
- User explicitly requested no tests. No tests, typechecks, browser/device QA, builds, commits, OTA or deployments were run in this work session. The earlier note's local/private restriction was retained.
- Everything below is implemented in local source only and remains unverified. Installed APK and public website do not yet contain these changes. No billing, hosting-plan or system changes were made.

## Catalog discovery
- Both APIs now normalize common aliases (Blood of Legacy -> Blood Legacy; All Queens Men -> All the Queen's Men; The 4 of Us -> The Four of Us) without inventing TMDB records.
- Exact creator-name searches include cast AND crew credits, so Tyler Perry searches include directed/written/produced titles, not just acting roles or matching title text.
- Mobile search now paginates both movies and TV; duplicate cards are removed.
- Web search queries movies and TV together. Person browsing includes crew credits.
- South Africa and Nollywood now use origin-country ZA/NG, not Afrikaans/Yoruba-only filters. Native Global adds both country choices and pagination; web Global gains Load more. Regional search shortcuts are added.
- Catalog entries are metadata. A title in TMDB is not evidence of an accessible stream. Homecoming is ambiguous; no invented catalog ID or fabricated playback was added for it, Inimba or any other requested title.

## Android background downloads (next APK 1.2.6 / code 11)
- MP4 transfers now use the native foreground service, not the JS DownloadTask path, when the module is installed.
- Added partial CPU/Wi-Fi locks, persistent transfer plans, START_REDELIVER_INTENT, stopWithTask=false, resumable HTTP byte ranges, and removal of the 60-second total call cap.
- Local HLS playlists/subtitles and recovery metadata are written before native transfer handoff. Native completion writes an atomic receipt, so Downloads can recover completed packages even if JS did not finish or the app process restarted.
- Saved packages retain their folder paths; existing saved records are still accepted. Artwork/subtitle backfill and deletion use actual recorded folders.
- Added native active-transfer snapshots and progress reattachment when Downloads regains focus. Manual pause removes the redelivery plan; existing partial files stay resumable.
- Android/OEM force-stop, expired source URLs, actual network loss, storage exhaustion and platform service time limits can still interrupt transfers. This has not been compiled or device-verified.

## Export
- Added folder-export button beside each saved title.
- Opens Android's folder picker and streams the original video/package and subtitle files into a new folder; no giant base64/JS copy.
- MP4 remains an MP4 plus sidecars. HLS remains the complete folder; open video.m3u8 in a compatible player and keep its files together. This does not transcode HLS into MP4.
- Existing 1.2.5 APK will ask for a newer APK for this native capability. New export Activity and bridge need a new build.

## Playback/1080 coverage
- Android Vidnest resolver now retains multiple returned stream/source candidates instead of selecting just one; rendition identifiers include variant indices to avoid collisions at identical resolutions.
- Web adds all 11 Vidnest backend requests from the existing mobile transport alongside Vidzee/Vix. Provider failures are isolated.
- Web configured fallback services resolve in parallel, even if another provider already returned a lower-quality source.
- Web signing uses stateless proxy URLs rather than cached sessions that collapse the master manifest. All HLS variants, separate audio and caption playlists remain available.
- Added real HLS quality, audio and embedded-caption controls; UI labels use Cineverse branding.
- Proxy now forwards Range/HEAD and upstream Content-Type/Content-Range for file seeking and progressive size metadata.
- 1080p appears only when returned by a provider/master manifest. This does not upscale lower resolutions or guarantee any provider works today. The browser cannot execute the entire Android WebView/Kotlin extractor stack.

## Web download repair
- Restored explicit movie/episode download actions on detail pages.
- Replaced bulky DownloadModal with simple quality rows and a save action. Progressive sources can expose their Content-Length; unknown sizes are explicitly unavailable.
- Supported HLS VOD can be streamed segment-by-segment directly to a chosen file in desktop Chrome/Edge; no whole-movie Blob buffering or one Worker request making thousands of upstream subrequests.
- Browser file export deliberately rejects encrypted, separate-audio, byte-range/fragmented or discontinuous packages it cannot save correctly. Use Android's full-package downloader for these. Browser tab must stay open for streamed file saves.
- No false 'completed' event is emitted just because a browser link was clicked.

## Before public delivery
1. Build a new Android APK from cine-verse-mobile with `npx eas build --platform android --profile preview`. It is marked 1.2.6/code 11, but no build was submitted. Install in place, do not uninstall; native fixes cannot be shipped as OTA alone.
2. For web local review, keep the existing worker dev command (`npx wrangler dev` in scraper-service) and Vite (`npm run dev`) running. Existing .env.development.local points to the local worker.
3. Public web playback requires a deployed reachable resolver. Firebase static hosting cannot run Android extractors or set third-party Referer headers. Reuse the existing free Worker configuration; no Firebase Blaze upgrade, paid storage or local system reconfiguration is required by these edits. Free Worker limits still apply and cannot be promised sufficient for unlimited video traffic.
4. When public deployment is authorized, authenticate Cloudflare, deploy the worker and set VITE_SCRAPER_BASE to its HTTPS URL in the production web build environment. PROXY_SECRET stays server-side in Wrangler secrets. Do not put it in VITE_ variables or disable URL signing. Then build/deploy the existing Firebase mainsite. These steps have NOT run.

## User verification checklist after installing/opening the new builds
- Global -> South Africa / Nollywood; scroll beyond first page. Search Tyler Perry, Inimba, Blood Legacy, All the Queen's Men, Homecoming and The Four of Us; distinguish missing metadata from missing playback.
- Open the actual movie/episode details first; Play; inspect actual quality/audio/caption options, including 1080p where provided. Report the exact title and season/episode if sources fail.
- Download a movie and an episode. Wait for the native downloading notification, background the app and lock the screen for several minutes. Reopen Downloads and confirm progress/completion, then offline playback and captions.
- Export a saved MP4 and an HLS package to a chosen folder. Verify MP4 directly; for HLS open video.m3u8 in a compatible player with all files together.
- On desktop web, pick a quality, save a supported file, and confirm the downloaded file plays. Unsupported packaging must show an honest explanation rather than producing a silent or broken file.

## Review APK delivered
User subsequently authorized build and installation. Signed EAS review build 09479d9f-c380-4885-b15d-89449c4a2f22 finished; APK 1.2.6/code 11 installed in place on Samsung R58M34PT7SN with ADB Success and PackageManager version confirmation. Downloads deep link launched. Functional verification remains with user. Web edits remain local/unpublished.

## Shared source correction
Updated the local web Worker Vidnest v2 public-transport decoding value to match the current public frontend and added its omitted ophim backend. Corrected mobile resolver checks independently returned full original-audio 23-minute Inimba S1E1 (480p) and The Four of Us S1E1 (1080p/720p/480p) playlists. Web correction remains local, unbuilt, unpublished. User will verify; no further functional tests.

## Global direct web playback — 20 November
- Existing full-screen HTML5/HLS player is retained. Shared sources resolve to media files/playlists; no advertising embed page or browser-popup playback is introduced.
- Web backend now streams each signed source to the browser as it resolves (NDJSON with regular JSON compatibility), keeping all 12 Vidnest backends plus Vidzee, Vix and configured upstream fallbacks. The current original-audio catalog runs early for every title. Slow/outage backends no longer hold every ready source until the end of the complete sweep.
- Web player retains the active source and playback position while additional source results arrive. Signed proxy URLs also cover external captions; HMAC key reuse reduces repeated import work on the existing free Worker.
- Added shared release-date guard and generic episode-number selection. Future episodes show their dates; missing season metadata does not force a different season or invent a catalog list. Provider transport failures are distinguished from successful empty responses.
- Worker TypeScript compilation passes. Web Vite/PWA build passes. Full website TypeScript check still reports existing CineMate/siteTracking errors; none in changed playback files. Functional/browser tests skipped per user request.
- Cloudflare auth is currently missing. Started Wrangler login and asked user to finish it in the browser; publication is pending that sign-in. No paid-plan change or hosting migration. Existing Firebase website remains unchanged until a reachable production resolver can be configured.

- Cloudflare sign-in completed. Worker code deployment succeeded: https://cineverse-stream-service.charlesbabuu0.workers.dev (code version c44838e0-0691-4386-9552-0b842c1d9b5b). Production PROXY_SECRET was generated in process memory and installed via Wrangler stdin; it was not printed or written into client code/files. No paid storage or paid service bindings were added.
- Production browser source default now points to that verified Worker URL and ignores localhost overrides in production. A complete production/prerender/PWA build and Firebase hosting:mainsite deployment are running. Shared proxy resolves relative playlist paths against redirect destinations and converts SubRip captions to browser-compatible WebVTT.

## Published global playback update
- Production Worker is live at https://cineverse-stream-service.charlesbabuu0.workers.dev with signed media and subtitle proxying. Cloudflare free account reused; no Firebase Blaze plan, paid storage, or hosting migration.
- Full production/prerender/PWA build passed after fixing an existing Global pagination hydration mismatch (server prefetch used ordinary data while the page expected infinite-query pages).
- Firebase hosting:mainsite deployment completed successfully at https://ourcineverse.web.app. Public web build points to the deployed resolver and keeps the in-site direct player, progressive source delivery, automatic source failover, quality/audio/caption controls and generic season/episode selection. No ad-embed fallback is used.
- Mobile Android preview OTA 6150445e-7dd7-48dd-b347-8d55156e38d0 (Android 01a1f98a-63a7-79a5-97d4-448cc5b153a7) published for runtime 1.2.8. No additional APK required for installed 1.2.8.
- Source changes are uncommitted. No movie/episode playback, file download, export, browser UI or device layout tests were run after the user asked to verify personally. Compilation and deployment completed; actual playback/download/OTA application remain user verification. Full website typecheck still has pre-existing CineMate/siteTracking errors; changed playback files and Worker/mobile compilation pass.

- Final website pass also switches automatically to usable sources that arrive after earlier sources have failed, without resetting a source already playing. Rebuilt and republished Firebase mainsite successfully. User feature verification remains outstanding.

## Automatic missing-season catalog enrichment — 20 November
- User correctly reported that Inimba still showed only season 1. The previous global correction preserved manually entered season requests but did not augment the selector's TMDB-only list. This correction changes the shared catalog feed itself.
- Added general secondary-guide lookup on the existing free Worker: exact title search plus premiere-year validation against TVSA. No hard-coded Inimba ID, season count or show-specific source route. Only season numbers, counts, broadcast dates and recurrence facts are extracted; third-party HTML/scripts/advertising are not returned to the app.
- The current actual guide parses Inimba S1 as 220 episodes and S2 as 260, with published dates and weekday schedules. The shared mobile/web adapter fills missing seasons and episodes while preserving existing TMDB IDs, real episode titles/artwork and dates. Numbered episode labels are used when no title is published.
- Additional episode dates are derived only if the published weekly recurrence yields exactly the published episode total between premiere/finale; otherwise dates remain unknown. Existing catalog dates are preserved. The common release checks therefore work for scheduled episodes too.
- Versioned TV details/season query keys prevent the prior one-season cache from hiding the change. Existing complete season lookups remain fast and do not wait for an unnecessary second metadata request.
- Mobile and Worker TypeScript compilation pass. Parser was checked against the actual saved guide HTML (both seasons/counts). No app/browser UI, playback, download or phone tests were run. Worker deployment running; client publication pending.

- Deployed catalog Worker version c8b81e03-0f39-4849-b72d-65b791757044. Live metadata endpoint returned HTTP 200 and both published Inimba seasons (220/260 episodes). Website production build passes, with no new catalog/playback TypeScript errors (existing unrelated full-site errors remain). Firebase deployment and runtime-1.2.8 Android OTA publication are in progress.

- Website catalog correction is published successfully at https://ourcineverse.web.app. The new live guide endpoint returned both Inimba seasons. Runtime-1.2.8 mobile OTA is exporting/publishing; no new APK or phone tests.

## Explore, captions and buffering follow-up
- Explore now has app-style genre chips and regional browsing for South Africa, Nollywood, Yoruba, Swahili and the other app regions. Country chips use origin country; language chips use original language. Search, Movies/TV, and advanced discovery filters remain available.
- Web player has a separate Subtitles control for provider files, HLS tracks and native browser tracks. It can load a local SRT/VTT file without uploading it. Subtitle selection maps to actual tracks instead of positions in the browser's combined track list. Streams without supplied tracks still depend on sources or a local file.
- The playback worker now reads caption lists from the existing resolvers, signs and normalizes external subtitle responses, and overlaps playlist rewriting operations in bounded batches. Cloudflare Worker deployed version 62231286-3386-4a98-963b-78635e018a47.
- Browser HLS starts with a conservative bandwidth estimate and adapts to the screen and connection. A prolonged stall tries the next source and keeps the playback position. Newly returned sources can play before all providers finish. Playback smoothness still depends on the provider and connection.
- The production build completed with the 1.2.9 APK link. GitHub confirmed public asset cine-verse-v1.2.9.apk (24,252,345 bytes). No browser/device playback tests were run per request.
- Firebase hosting:mainsite deployed successfully. The live Explore HTML includes the genres, South Africa and Nollywood chips. The live Download page targets the public 1.2.9 APK. The GitHub asset SHA-256 matches the installed Expo APK (a7aa0ad8bdd2d374a3ebf6020ea224c36dc85c3dcfb639138e97785d956da510). Playback, captions and background downloads remain for user verification.

## 21 November follow-up
- Pushed the previously shipped website and playback worker baseline (83883a5).
- Consolidated the movie hero and series episode controls around Play and Download. Grouped the web Downloads library into compact rows, with playback starting only on demand. Explore keeps the genre and region choices visible and folds year, rating and sorting into Filters.
- Download quality probes now run once per source per dialog. Choices arrive independently and preserve the selected file. The player keeps matching subtitle choices when changing sources and tries an alternative sooner after repeated buffering.
- Checked the latest RTDB entries using authenticated Firebase CLI reads without printing event contents. The main feed had a recent event. The last launch feed event was from 16 October UTC, so the default seven-day view has no launch feed activity.
- Dashboard keeps the last results in memory while reconnecting for the same admin. If the realtime feed stalls, it attempts a Firebase HTTPS read with the signed-in Firebase account and refreshes every minute while realtime is unavailable. The dashboard shows which mode it is using without exposing private logs or changing database access rules.
- Production build passed. This pass did not run playback or authenticated browser feature tests.
- Website polish and analytics reconnect changes deployed. A read-only sample of 500 recent main-feed events contained 61 page views and 21 distinct session IDs. The dashboard now waits for the main feed before showing totals, so an empty launch feed cannot present a false zero for all platforms. A genuinely empty selection is labeled accordingly.
- Removed the CinePet panel from the private analytics dashboard as requested. Main dashboard error handling and sign-in remain available.
- Deployed the main-feed readiness correction and website pet removal to Firebase Hosting. The dashboard URL responds and the published build has no CinePet chunk. The signed-in dashboard remains for the user to verify.
- Published and verified the 1.2.10 link on the live website download page. Its public GitHub APK SHA-256 matches the Expo artifact installed on the Samsung. The live deployment includes the main-feed guard and dashboard pet removal.

## Web subtitle and source selection repair, 21 November

- Reproduced the search mismatch. TMDB returned zero movies for “how to loose a guy in 10 days”. The corrected search returned movie 9919 first. Web search now retries “to loose” as “to lose” when the original search has no matches.
- The web subtitle picker now combines embedded tracks, subtitle files from every source for the current title, and an independent OpenSubtitles catalog lookup keyed by IMDb ID and exact episode. Catalog lookup runs when the picker opens. Switching video sources preserves the selected file. Fixed the order in which HLS and the browser apply track selection, since switching HLS renditions can disable an external file.
- Removed the eight- and fifteen-second automatic switches during buffering. The same video element stays mounted as results arrive. Terminal media failures can select another source, and previously failed sources can be retried manually.
- The proxy now sends a single content type for rewritten playlists and captions. Verified the deployed Worker (1a386eed-7cb4-4082-9e65-1d158d092cd2) served English WebVTT with timed cues for How to Lose a Guy in 10 Days (16 languages listed) and Game of Thrones S1E1 (25). A TV playlist and the first bytes of its media segment were accessible.
- Inimba S2E1 and All the Queen’s Men S5E15 each returned zero streams and zero catalog caption files in this sample. All 17 stream checks reported failure for each episode. Browser playback and caption timing remain for the user to verify.
- Firebase Hosting deployment completed. The live player bundle matched the production build byte for byte.

## Download picker contrast
- Fixed the dark download and playback dialogs inheriting near-black text and a light native control scheme when the site is in light mode. The selected download row now has a gold border, and the player quality selector has a filled active state.
- Built and deployed Firebase hosting:mainsite. Opened How to Lose a Guy in 10 Days on the live site in Chrome. Verified the download heading and resolution labels render as #f8f4ea against #141217 in both themes. Captured the light-mode sheet with 1080p, 720p and 480p visible.

## Single-file web downloads
- Removed the in-page segment copier. Direct files use the browser downloader. A dedicated download service worker remuxes supported HLS video and default audio into one fragmented MP4 at the selected quality with bounded segment buffers and backpressure.
- Chrome received one attachment named How to Lose a Guy in 10 Days.mp4. Closed the movie tab and verified the transfer grew from zero to 623,757 bytes, then cancelled the test. Full-length completion and other browsers were not tested.
