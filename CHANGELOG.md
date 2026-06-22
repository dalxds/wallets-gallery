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

## [1.2.2] - 2026-06-22

Shared screen, flow, and app links — and their social preview cards — now hold up on the live
deployment, not just a local server. The cards build their thumbnails by fetching the screenshots
from the CDN, and only the small per-capture data ships with the on-demand pages, so a card or a
deep-linked screen renders the same in production as it does locally.

Switching the capture date now keeps you on the tab you were viewing: change the date while on
Flows and you stay on Flows, instead of being bounced back to Screens.

### For contributors

- The OG card renderer (`lib/og.tsx`) now `fetch`es the content-addressed PNGs from the CDN
  (`assetBaseUrl` in the new `lib/site.ts`) instead of `readFileSync` from the function bundle, so
  no image bytes are traced into the serverless functions. `next.config.mjs` adds
  `outputFileTracingIncludes` (only `index.json` + `view.json`) and `outputFileTracingExcludes` (the
  screenshot PNGs, `graph.json`, and `_staging` snapshots) for `/apps/**` — the dynamic
  `readFileSync` paths in `lib/captures.ts` otherwise make Next glob the whole capture tree into
  every function, which ENOENTs or blows the 250 MB function limit on Vercel even though it works
  under `next start`.
- Copy-image / copy-link / download now live in one place (`lib/clipboard.ts`), shared by
  `image-actions.tsx` and both viewers, and guard `res.ok` so a missing screenshot is skipped
  rather than copied/saved as a 404 body. The date picker (`date-control.tsx`) derives its target
  tab from `usePathname()`. The app-level OG route returns 404 for an unknown slug (matching the
  page). Every `opengraph-image` route sets `revalidate = false` so each card composites once.

## [1.2.1] - 2026-06-19

The site now has a logo. The header pairs a stacked-gallery mark with the "wallets gallery"
wordmark, and the same mark is the browser-tab favicon (it follows the tab's light/dark theme).

### For contributors

- The mark is the `GalleryVerticalEnd` icon from `lucide-react`, used in
  `components/layout/site-header.tsx`. The favicon is `app/icon.svg` — the same icon drawn as a
  static SVG with a `prefers-color-scheme` rule for dark tabs; it replaces the old default
  `app/favicon.ico`, which was removed.

## [1.2.0] - 2026-06-19

The screen and flow lightboxes — and their full-page versions on a shared or refreshed link —
now open with a single-row header: the app's logo and name, a divider, then the name of the
screen or flow you're looking at. The logo and app name are a link back to that capture (on its
date) — to its Screens tab from a screen, its Flows tab from a flow. The capture date moved to the
bottom: bottom-right next to the screen counter (`Apr 1, 2026 · 7 / 62`) for a screen, and for a
flow the screen count sits bottom-left with the date bottom-right. The modal and the standalone
page now look identical apart from the modal's close button and the page's site bar on top. On a
direct link, the lightbox now lines up under the site's "wallets gallery" logo instead of running
edge-to-edge on a wide screen.

Two rough edges went away with the rework: opening a screen or flow no longer flickers — the
loading skeleton now matches the lightbox exactly (same dim, frame, size, and layout), so the image
drops straight in instead of flashing a dark scrim and re-animating over it; and a one-screen flow
is centered like a multi-screen one instead of sitting at the left edge.

### For contributors

- New shared `LightboxHeader` (`components/lightbox/lightbox-header.tsx`) renders the one-row
  breadcrumb (logo + app name `Link` → `backHref`, divider, current title, optional close) for
  both viewers in both forms. The header now lives **inside** `ScreenViewer` / `FlowViewer`
  (`components/lightbox/`) rather than in the wrappers, because the screen title and the counter
  are viewer state and must stay in sync as you page. Each viewer gained `appName`, `backHref`,
  and an optional `onClose` (set only by the modal, which renders the close `X`).
- The wrappers compute `backHref` so the latest/date split stays in `lib/links.ts`:
  `screen-lightbox` / `screen-page` pass `captureBase(slug, date, latest)`; `flow-lightbox` /
  `flow-page` pass `flowsHref(slug, date, latest)`. `FlowLightbox` now also takes `latest`,
  threaded from both flow `@modal` routes, to build that link. The standalone pages dropped their
  own header bar (they keep `SiteHeader`); the modal wrappers dropped theirs (the `X` moved into
  the header).
- The standalone pages (`screen-page` / `flow-page`) wrap the viewer in `mx-auto max-w-[1600px]`
  — the same column as `SiteHeader` — so the app logo lines up vertically with the site logo on
  screens wider than 1600px (it already matched below that width).
- `ModalSkeleton` (`components/lightbox/modal-skeleton.tsx`) was rebuilt to mirror the lightbox
  exactly so the `@modal` fallback never flickers into the real viewer. It takes a `variant`
  (`"screen"` | `"flow"`), matches the real `Dialog`'s scrim (`bg-black/10` + blur, not the old
  `bg-black/80`), frame, and per-variant size, and renders the same one header row (logo + name +
  divider + title + close) and 3-column footer (count/chip · actions · date). When the real viewer
  swaps in there's no scrim flash, no resize, and no row reflow (sizes match the real controls —
  `h-8` actions, `size-9` close).
- `DialogContent` / `DialogOverlay` (`components/ui/dialog.tsx`) gained an `animate` prop; the
  lightboxes pass `animate={false}` so the dialog appears in place over the skeleton with no
  enter/exit fade-zoom — the last piece of the no-flicker open.
- `FlowViewer` (`components/lightbox/flow-viewer.tsx`) gives the step strip `w-full` and centers it
  (`justify-center`) when the cards don't overflow, so a one-screen flow is centered instead of
  shrinking to its content at the left edge; overflowing strips still left-align and scroll the
  active step into the middle.
- Both forms share one surface color: the standalone wrapper is `bg-popover` (matching the modal's
  `DialogContent`), so the header, footer, and stage read identically in the lightbox and the full
  page. In dark mode `--popover` (`0.205`) is lighter than `--background` (`0.145`), which had made
  the page look darker than the modal; in light mode both are white, so nothing changes there.
- The lightbox frame is a touch rounder — `rounded-2xl` (18px) on both lightbox `DialogContent`s
  and `ModalSkeleton`, and `rounded-t-2xl` on the standalone panels (top corners only, since the
  panel's bottom meets the viewport edge; horizontal size is unchanged, so the logo alignment
  above is preserved).

## [1.1.0] - 2026-06-19

The gallery's Screens and Flows tabs are now real, shareable pages — Screens at `/apps/<app>` and
Flows at `/apps/<app>/flows` — so a tab is just a link you can bookmark, share, or open in a new
tab, and the back button works the way you'd expect. Switching tabs is instant (both pages are
prebuilt and prefetched). Opening a flow from the Flows tab keeps the gallery behind the modal on
Flows instead of snapping to Screens, and opening an app from the home page always starts on
Screens rather than replaying whatever tab you last had open.

### For contributors

- The Screens/Flows tab is now a **route**, not client state. Each tab is its own prerendered page
  under a `(gallery)` route group — `(gallery)/page.tsx` (Screens, `/apps/[slug]`) and
  `(gallery)/flows/page.tsx` (Flows, `/apps/[slug]/flows`), mirrored under `[date]/`. The shared
  chrome lives in `(gallery)/layout.tsx` → `GalleryFrame` (`components/app-detail/gallery-frame.tsx`),
  so it persists across the tab switch and only the panel beneath swaps. `TabBar` is now `<Link>`s
  with `usePathname()` for the active state (prefetched, no `?tab`, no de-opt of static
  generation). This replaces the previous `TabState` client island (`tab-state.tsx`) +
  `[data-active-tab]` CSS panel toggle: deriving tab visibility from a route removes the modal-route
  `?tab` drop and the out-of-band `setAttribute` that leaked a stale tab through the App Router
  cache. The `@modal` intercept slot is unchanged and overlays either tab. Removed: `app-detail.tsx`,
  `tab-state.tsx`, the `[slug]`/`[date]` `page.tsx` wrappers, `galleryTabHref` (→ `flowsHref` +
  `captureBase`), and the tab CSS in `globals.css`.

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
