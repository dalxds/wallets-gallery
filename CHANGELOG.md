# Changelog

All notable changes to the **app** (the gallery site, the packager, and the build scripts)
are recorded here. Captured app data under `public/captures/` is content, not a release:
adding or updating a capture does not get a changelog entry or a version bump. See
"App vs. captures" in `CLAUDE.md` and the README for the split.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The app version
in `package.json` follows [Semantic Versioning](https://semver.org/), bumped by the *scale*
of the change rather than the file count:

- **PATCH** (0.0.x): a bug fix, doc tweak, or small additive change.
- **MINOR** (0.x.0): a new capability you would mention to someone (a packager stage, a UI
  surface, a build step), or a substantial refactor.
- **MAJOR** (x.0.0): a breaking change to the data contract (the graph/view schema or the
  `overrides` keys) or to the published routes.

Lead each entry with what a reader can now do that they could not before. Use plain language,
no hype, real file names and commands. Keep branch history, review notes, and internal
version bumps out of it. Put contributor-facing notes under a "For contributors" subsection.

## [Unreleased]

## [1.0.0] - 2026-06-19

Every screen and flow now has its own shareable link with a matching social preview card, and
images load much faster. Open a screen or flow in the gallery and it appears in a lightbox;
share or refresh its link and it opens as a **full-screen version of that same lightbox** (same
prev/next, step strip, and actions) with the app's name + capture date in the header. Opening a
screen pops a skeleton while it loads, and paging prev/next is instant and flicker-free — the
adjacent screenshots are prefetched, so the next one is already there.
Copy-link buttons pin the capture date, so a shared link keeps resolving to the same capture
even after a newer one lands. Screenshots are optimized on the fly — modern formats, right-sized
thumbnails — so grids and flows load quicker.

### Breaking changes

- Screen and flow deep links are now real routes — `/apps/<app>/screen/<id>` and
  `/apps/<app>/flow/<slug>` (dated variants under `/apps/<app>/<date>/…`), built through
  `captureBase` in `lib/links.ts`. The old `?screen=` / `?flow=` query deep-links and the
  `[[...date]]` route are gone, so links shared with the old query params no longer open the
  lightbox. Hosting now requires Vercel (or a Node runtime) — the site is no longer a pure
  static export servable from any CDN.

### For contributors

- The site is now **Vercel-native**: `output: "export"` is dropped. Home and per-capture gallery
  pages stay prerendered (SSG); screen/flow pages and their OG images render on demand and cache
  (`dynamicParams = true`), so the long tail of screens never inflates the build.
- Screen/flow lightboxes are **intercepting + parallel routes** (`app/apps/[slug]/@modal/…`): a
  tile click is intercepted into a modal over the gallery; a direct/shared link renders the
  standalone page (`components/standalone/`). Mirrored under `[date]/` so historical captures
  behave the same. The old `?screen=`/`?flow=` query state and the nuqs lightbox islands are
  gone; deep links are real routes built through `captureBase` in `lib/links.ts`.
- The lightbox and the standalone page share one body — `ScreenViewer` / `FlowViewer` (+
  `LightboxImage` for the skeleton, which falls back to an "unavailable" icon if a screenshot
  fails to load). The lightbox wraps it in a `Dialog`; the page wraps it in the site navbar +
  an app-logo header. Prev/next pages via `window.history.replaceState` (no router navigation →
  no remount, no flicker); copy buttons use the date-pinned `screenShareHref` /
  `flowShareHref` helpers. Each intercepted route (`@modal/(.)screen` / `(.)flow`) has its own
  `loading.tsx` (`components/lightbox/modal-skeleton.tsx`) so a tile click shows a skeleton
  immediately while the route streams — scoped to the intercept so a tab/date switch doesn't
  flash the modal scrim.
- Images use `next/image` with a cost-trimmed `images` config (AVIF/WebP, few sizes, one quality,
  1-year TTL) plus immutable `Cache-Control` on the content-addressed PNGs. No build-time image
  precompute — Vercel optimizes on demand. Grids and strips stay lazy; the screen viewer eagerly
  prefetches the two adjacent screenshots (hidden, same `sizes`) so prev/next is a cache hit, and
  the standalone hero is marked the LCP (`preload`).
- Open Graph cards via `next/og` at the site, app, screen, and flow levels (`opengraph-image.tsx`,
  rendered from `lib/og.tsx`). `metadataBase` added in the root layout for absolute URLs.
- `scripts/prune-export.ts` is removed; `.vercelignore` replaces it as an **allowlist** —
  the deploy ships only `*.json` + `*.png` under `public/captures/` (minus `*.snap.json` and
  `_staging/`), so a stray secret, snapshot, or `.DS_Store` can't leak by default. The
  committed `*.snap.json` snapshots were untracked and gitignored. `pnpm start` is now
  `next start`.

## [0.1.1] - 2026-06-17

### Fixed

- Scrolling through a flow's screens no longer drifts the page vertically: the
  horizontal screen strip is now locked to horizontal panning, so a sideways
  swipe or trackpad scroll stays on the flow instead of nudging the page up and
  down.

## [0.1.0] - 2026-06-17

First documented release of the gallery.

A static, CDN-servable site for browsing **captured mobile-app UI flows** from crypto-wallet
and fintech apps. Browse the grid by screen or open any app to see its screens and the named
flows between them, with state variants (empty, funded, error) folded into on-screen
switchers and each flow carrying a replayable `.ad` script. Everything the site shows is
derived deterministically from one committed `graph.json` per capture by the packager in
`lib/packager/`, then exported to static HTML, so there are no runtime data fetches.

### For contributors

- Versioning and changelog discipline starts here: the **app** is versioned (this file plus
  the `version` field in `package.json`); **captures** under `public/captures/` are content
  updates, tracked by commit only.
- Generated `view.json` and `index.json` are committed and kept in sync with their source by
  re-running `pnpm build-data`.
