# Ads / Popup Prevention - Third-Party Embeds

Context: `src/components/sections/VideoPlayer.tsx:317-327` embeds third-party players via cross-origin `<iframe>` from sources defined in `src/utils/embedSources.ts:6-50` (`vidlink / vidcore / 2embed / multiembed`).

Constraint: Same-origin policy gives us zero control inside their player. We cannot remove ads inside the iframe, only contain / reduce them. Hard-blocking with adblock / strict `sandbox` causes providers to fall back to in-video overlay / VAST ads rendered on the media player screen.

Current mitigation already in place: `autoplay=false` on all embed URLs.

## 1. Tuned `sandbox` - containment, not removal

Use `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` on the iframe, omitting `allow-popups` and `allow-top-navigation`.

- Pro: Browser natively blocks new-tab / redirect popups.
- Con: Breaks some sources. Fullscreen, autoplay, or full player load can fail. Must be tested per-source, not applied globally. `2embed / multiembed` almost always break under sandbox.

## 2. Click-shield overlay - what 90% of streaming sites do

Transparent div + big Play button over the iframe. First 1-2 clicks are almost always ad-triggers: swallow them, then set `pointer-events: none` for 5-10s to pass input through to the real player.

- Pro: Kills ~80% of accidental popups, does not break playback.
- Con: One extra click for the user.

## 3. Source ranking + badges

Sources are already ranked in `embedSources.ts`. Keep cleanest first:

`Vidlink > VidCore > 2Embed > SuperEmbed`

- Add `Clean / Heavy ads` badge per source.
- Remember last-working source in `localStorage`.
- Add `Report heavy ads` button to feed back into ranking.
- Zero breakage risk.

## 4. Popup-guard + education UX

`window.open` inside their cross-origin iframe cannot be overridden from the parent, but we can:

- Keep `autoplay=false` (already done).
- Show warning bar: `Source is third-party - if a new tab opens, close it, your movie is safe.`
- Detect `blur / visibilitychange` right after Play click and toast: `Popup opened? Just close it and return.`
- Do not auto-switch sources too aggressively (current 12s fallback in `VideoPlayer.tsx` can confuse users when a popup opens).

## 5. What NOT to do

- Inject JS into the iframe: impossible with CORS / same-origin policy.
- JS adblock in frontend code: impossible, only browser extensions can do this.
- Backend proxy to strip ads: works briefly, then breaks, plus bandwidth cost and ToS / legal risk.

## Recommended combo

`2 + 3 + 4`, with `1` tested only on Vidlink / VidCore.
