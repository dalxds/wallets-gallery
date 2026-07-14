# Changelog

All notable changes to the **app** (the gallery site, the packager, and the build scripts)
are recorded here. Captured app data under `public/captures/` is content, not a release:
adding or updating a capture does not get a changelog entry or a version bump. See
"App vs. captures" in `CLAUDE.md` and the README for the split.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The app version
in `package.json` follows [Semantic Versioning](https://semver.org/), bumped by the _scale_
of the change rather than the file count:

- **PATCH** (0.0.x): a bug fix, doc tweak, or small additive change.
- **MINOR** (0.x.0): a new capability you would mention to someone (a packager stage, a UI
  surface, a build step), or a substantial refactor.
- **MAJOR** (x.0.0): a breaking change to the data contract (the graph/view schema or the
  `overrides` keys) or to the published routes.

Lead each entry with what a reader can now do that they could not before. Use plain language,
no hype, real file names and commands. Keep branch history, review notes, and internal
version bumps out of it. Put contributor-facing notes under a "For contributors" subsection.

## [5.0.0] - 2026-07-14

Flows now read as intentional user journeys instead of fragments inferred from navigation
shape. Alternate origins no longer duplicate flows, one-screen destinations remain visible,
and data or lifecycle variations share one switchable step.

### Fixed

- Replay is marked available only when it contains a complete, non-empty command sequence;
  selector-less transitions and back gestures can no longer produce silently truncated picker
  scripts. Inline pickers also retain the recorded action label on the following spine step.
- Child-flow context keeps split-pinned in-place launchers while retaining the exact parent
  variations that expose the transition; unavailable variations no longer appear on that step.
- Screen-to-flow chips preserve browser history and the active screen variation. Cross-flow chips
  appear only on their exact source variation, and a variation deep link changes only the step
  named by `?step`.
- Flow validation now reports malformed drafts without crashing, accepts legitimate brand casing,
  warns about uncovered main-navigation sections and canonical disposition collisions, and exits
  non-zero for hard errors. Audit and migration package scripts now process all captures.
- Custom variation ordering uses codepoint comparisons, keeping generated data identical across
  build-machine locales.

### Changed

- Every dated capture now commits `flows.json` beside `graph.json`. Stable flow ids, names,
  hierarchy, local steps, alternate entries, and intentional omissions are authored there;
  the graph remains the source for observed screens and transitions.
- Flow URLs use stable authored ids verbatim. Existing name-derived flow URLs are intentionally
  replaced without redirects.
- The gallery shows generalized variation labels, optional immediate context tiles, and
  semantic flows even when direct replay is unavailable. Alternate entries identify exact
  source and destination screens and switch flows in place at the corresponding step.
- Avici, RedotPay, and Tuyo have reviewed semantic packages with complete screen accounting.

### For contributors

- `packageGraph(graph, flows)` is a strict deterministic builder. The dominator segmenter,
  mechanical flow naming, structural duplicates, length caps, `namingTODO`, and graph-level
  `flowNames`/`structure` overrides have been removed.
- New inventory, draft validation, all-capture audit, and mechanical reference-migration
  commands support the semantic authoring loop. `build-data` requires every graph/flows pair
  and reports replay gaps without treating them as semantic errors.
- Hierarchy validation advises authors to merge a sole child's steps into its parent while
  preserving the parent identity, unless both intents are independently useful.
- Separate naming validation rejects camel/Pascal-case canonical titles without influencing
  semantic membership or hierarchy.
- Variation deep links keep the rendered step and use a lowercase kebab-case variation name;
  validation rejects missing names and names that would collide after URL normalization.
- Temporal provenance, retention, retirement, and reference re-binding remain a separate
  follow-up and are not part of this schema.

## [4.3.0] - 2026-07-03

A reliability pass across the packager, the build, and the viewer UI: flows that used to go
missing now show up, the lightbox and tabs behave, images and downloads are correct, and the
pages you load are lighter.

### Fixed

- **Flows no longer vanish.** Two cases that dropped whole flows from the Flows tab are fixed: a
  picker/sheet opened from a flow's _first_ screen is now woven inline as a step, and a branch
  reached only through a coarse-skeleton transition that was forced to `in-place` (then pinned
  apart with `overrides.splits`) is kept instead of silently disappearing. On one existing
  capture this brought back four flows that were previously unreachable.
- **The lightbox closes when it should.** Clicking the app name/logo in an open screen lightbox
  now returns you to the gallery instead of leaving a stale modal floating over it.
- **The Screens/Flows tab keeps the right highlight** while a lightbox is open (it used to jump
  to "Screens" behind the scrim).
- **Filtering the flow sidebar** no longer leaves an empty expandable stub on a parent whose
  matches are all filtered out — it renders as a plain row.
- **Flow step screenshots render sharp on large displays.** They used to request a 384px image
  and stretch it; the requested size now tracks the rendered size.
- **Copying a screenshot works in Safari**, and the button tells the truth — "Image copied" when
  the image lands, "Link copied" on the URL fallback, and nothing on failure. Downloads (single
  and "download all") no longer save zero bytes.
- **Grid downloads are named like the viewers** (`<app>-<screen>.png`, `<app>-<flow>-step-N.png`)
  instead of by content hash, so a folder of saved screens is legible.
- **A dead capture date never reaches the date picker.** A date listed in `app.json` with no
  `graph.json` used to appear in the dropdown and 404 when selected; it's now excluded.
- **A replaced app logo reaches the share cards.** `logo.png` is content-versioned, so swapping it
  busts the cross-deploy Data Cache that pinned the old bytes onto every Open Graph card.

### Changed

- **Pages are lighter and faster.** The client no longer downloads the ~90KB+ per capture of screen
  text, interactive-element lists, and replay scripts that no UI reads (the archival `view.json`
  keeps them), and the shared app shell no longer ships an unused tooltip provider — so the browse
  page and every gallery hydrate less.

### For contributors

- **Packager determinism is now enforced.** Reordering `graph.json`'s nodes or edges can no longer
  change the view: fixes to the SAF merge/split unions, the `(from,to,action)` edge dedupe and
  parallel-edge selection, the top-level anchor order, and `overrides.structure` cycle-breaking are
  each pinned by tests in `tests/packaging/`. `overrides.flowNames` keys are canonicalized through
  the SAF map (so a re-capture merge doesn't drop an authored name) and the contract is realigned —
  the key is the flow's **name key** (`nameKey`), documented consistently in `types.ts`, the
  capture-skill docs, and this README.
- **`pnpm build-data` validates each `graph.json`** (same contract as `scripts/package.ts`) before
  packaging and **fails the build** on an invalid graph; it warns on any flow left unreachable from
  the flow tree. `index.json` is emitted in sorted, filesystem-independent order, omits dead capture
  dates, is typed against `AppIndex`, and its `logo` field carries a `?v=<hash>` cache-buster.
- **OG asset fetching is environment-aware:** a preview deploy with a Protection-Bypass secret
  composites its _own_ captures; production is unchanged (`lib/site.ts`).
- **New/removed surfaces:** `lib/client-view.ts` strips server-only view fields at the client
  boundary (typed via `ClientScreen`/`ClientFlow`/`ClientCapture`); `lib/use-copy-feedback.ts` is the
  one shared copy-flash hook; `readRegistry()` is the single registry read (browse + `llms.txt` no
  longer re-implement it). Removed the dead bare-slug `opengraph-image` route and
  `graph.ts`'s unused `reachableFrom`. `lib/packager/` and `scripts/` are now actually excluded from
  prettier (`.prettierignore`).

## [4.2.0] - 2026-07-01

### Added

- Apps can now show a real **logo**. Drop a `logo.png` into an app's folder
  (`public/captures/<slug>/logo.png`) and it becomes the app's mark everywhere — the browse
  grid, the capture header, the screen/flow viewers, and the Open Graph share cards. An app with
  no `logo.png` keeps the generated `avatar.vercel.sh` avatar, so nothing regresses.

### Changed

- Per-app Open Graph cards are now **flat** (near-black, no brand-colour wash). Each card used to
  derive a colour from the app's avatar gradient; with real logos there's no cheap colour to
  extract, so the wash is gone and the logo/avatar mark carries the identity. The home card's
  fixed amber/teal wash is unchanged.

### For contributors

- New `lib/app-logo.ts` (`appAvatarSrc(slug, logo)`) is the single "logo, else avatar" resolver
  used across the UI; `lib/og.tsx` keeps its own byte-inlining path for the cards.
  `scripts/build-data.ts` records each app's logo presence as `logo` on `index.json`
  (`AppIndex.logo`), so no component reads the filesystem. The colour-derivation helpers
  (`brandColors` / `brandWash` and friends) were removed from `lib/og.tsx`. Logos are `.png`
  (already allowlisted by `.vercelignore`).

## [4.1.4] - 2026-07-01

### Changed

- The sticky capture header now reads as one bar when you scroll. The top navbar is solid, so
  it no longer shows a hairline seam against the frosted app header beneath it (previously two
  stacked translucent layers met at a visible edge). The rule under the Screens/Flows tabs is
  the header's clean bottom edge, and the space below it is unfrosted breathing room rather than
  a frosted band.
- The Screens/Flows tab counts now sit as lighter superscripts (`Screens⁶²`) instead of
  `Screens (62)`.
- On the Flows tab, the sidebar (its filter field and flow tree) keeps a gap below the header
  when scrolling instead of collapsing flush against it, and it stays aligned with the flows
  column and with where clicking a flow scrolls to.

## [4.1.3] - 2026-06-30

### Changed

- Open Graph cards now read "Captured on <date>" instead of "Last captured <date>", so a
  shared link to a historical capture reads correctly (the date is that capture's, not the
  newest). Applied across the app, screen, and flow cards for consistency.

## [4.1.2] - 2026-06-30

### Fixed

- Sharing a capture's canonical link (`/apps/<slug>/<date>` and its `…/flows` tab) now shows
  the app's preview card. The dated gallery had no Open Graph image of its own, and the page's
  `openGraph` metadata overrode the one inherited from the app route, so links unfurled with no
  image. A dedicated `opengraph-image` now lives in the `(gallery)` route group and is shared by
  both tabs.

### Changed

- The capture page's share/title metadata now matches the screen and flow pages: the title is
  `wallets.gallery - <App Name>` and the description is `<App Name> on <Jun 29, 2026>`.

## [4.1.1] - 2026-06-30

### Changed

- The site now reads as **wallets.gallery** throughout: the navbar wordmark carries the dot,
  the home page tagline is "A showcase of money apps curated by agents" (its share card and
  `/llms.txt` line use the same phrase), and the Apps gallery subtitle now shows live totals
  summed from the registry at build time (e.g. "3 apps · 210 screens · 122 flows").
- Sharing a screen or flow link now shows a cleaner preview: the title is `wallets.gallery -
<App Name>` and the description reads `<Screen or Flow name> in <App Name> on <Jun 29, 2026>`.

## [4.1.0] - 2026-06-30

### Added

- You can now fetch a capture's data at a stable, date-free URL:
  `GET /captures/<slug>/latest/view.json` (and `…/graph.json`) redirects (307) to the newest
  dated file. A tool or agent reading the gallery no longer has to fetch `index.json` first just
  to resolve today's date — it's the data-side mirror of the existing `/apps/<slug>` page
  redirect. The dated URLs are unchanged and remain the canonical, immutable locations; the
  alias is an additional convenience.
- `/llms.txt` now documents the `latest` alias and spells out how to resolve a screenshot's
  relative path (`assets/…` is relative to the app root `/captures/<slug>/`, not the dated
  `view.json` URL — assets are content-addressed and shared across an app's captures).

#### For contributors

- The redirects are baked per app from `public/captures/index.json` at build time in
  `next.config.mjs` (`redirects()`), so they track each app's `latest` on every build. They are
  `permanent: false` (**307**, not 308) on purpose: "latest" moves when a newer capture lands, so
  the redirect must never be cached as permanent.

### Changed

- Link previews — the Open Graph cards shown when a gallery URL is shared on Slack, X, iMessage,
  and the like — are redesigned across all four levels to match the app itself: a near-black
  card, Inter at the app's weights, the app's corner radii and white/10% borders, and just a
  whisper of the app's brand colour as a background wash. The `wallets.gallery` wordmark carries
  the site icon (the same gallery glyph as the in-app header):
  - the **home** card is a centred lockup — the site logo, `wallets.gallery`, and the tagline
    "A showcase of money apps curated by agents";
  - an **app** card is a single centred lockup — the app's avatar mark, its name, and a quiet
    `N screens · N flows` / last-capture line (no screenshot);
  - a **screen** card pairs the full screenshot with its app, title, and capture date;
  - a **flow** card shows the app, flow name, and screen count above the first steps as a flat
    strip, with a `+N` tile counting any remaining screens.

#### For contributors

- `lib/og.tsx` is rebuilt around a shared design system that mirrors the app's dark tokens (one
  minimal card frame, flat avatar marks, flat bordered screenshot tiles) instead of four ad-hoc
  layouts. Per-app brand colors are the two gradient stops parsed from `avatar.vercel.sh/<slug>.svg`
  (fetched + force-cached), used only as a soft background wash, with a deterministic slug-hash
  fallback so a card is never colorless. The wordmark mark is the site's own icon (`app/icon.svg`),
  distinct from the per-app avatar mark.
- The cards are set in Inter (the site sans): TTFs live in `lib/og-fonts/` (with a Noto Sans
  glyph-coverage fallback) and are bundled into the OG functions by `outputFileTracingIncludes` in
  `next.config.mjs` — the same mechanism that ships the capture JSON. Fonts are read off disk
  lazily; a module-top read would crash gallery-page prerendering. One satori gotcha worth
  knowing: a bare numeric JSX child is miscounted as multiple nodes, so number values are coerced
  to strings. See `lib/og-fonts/README.md` for font provenance/license.
- Secondary text meets WCAG AA on the dark card (4.5:1+), screenshots are contained (fully
  visible, never edge-cropped), and a hairline keeps the near-black card defined on dark surfaces.

## [4.0.1] - 2026-06-26

### Changed

- The Apps home page is now a single responsive grid. Each app shows just its icon, name, and
  latest capture date — the preview screenshot and the screen/flow counts are gone, and so is
  the list/grid view toggle. Sorting (Latest / A–Z) is unchanged.

## [4.0.0] - 2026-06-24

### Changed

- Pickers and sheets are now part of the flow they belong to instead of being hidden in the
  Screens tab. A picker you open and pick from — choosing a country during onboarding, choosing a
  deposit method — appears inline as a step in the journey, in the right place, with the journey
  continuing past it. Informational sheets (a "requires USDC" notice, a "quote details" panel)
  likewise show up as steps. tuyo's "Creating an account" now reads end to end including its
  country and deposit-method pickers.
- A screen whose rows all open the same kind of detail (an asset list where every row opens an
  identical asset page) shows **one** example journey instead of one flow per row. The other rows
  stay browsable in the Screens tab.

### Breaking

- Each flow step now carries a `kind` of `"forward"` or `"picker"` (`view.flows[].steps[].kind`).
  The marker is internal — a picker step renders like any other — but it is a new required field
  on the step shape.

### For contributors

- `lib/packager/segment.ts` detects return-to-launcher **excursions** structurally and returns
  them per launcher (`excursionsByLauncher`); `lib/packager/index.ts` weaves them inline as
  `kind:"picker"` steps right after their launcher (the spine continues from the launcher's
  forward exit, so the trunk isn't shattered). The homogeneous detail fan-out collapses via the
  SAF family signal: same-family leaf siblings under a hub keep one exemplar.
- `lib/packager/replay.ts` (`buildReplay`) now consumes the woven step plan; a picker step
  expands to open (launcher→picker) + select (picker→launcher) before the spine continues.
- Completes `docs/flow-segmentation-redesign.md` (Stage 3, built on the Stage 4 dominator core).
  `ViewStep.kind` added to `types.ts`; README updated.

## [3.0.0] - 2026-06-24

### Changed

- Flows are now derived from the app's **navigation structure** rather than the path the walk
  happened to take, so journeys read truer. A screen you can only reach by passing through
  another nests under it; a deep journey keeps its full tail instead of being cut short when a
  later screen happens to be reachable more cheaply elsewhere. For example, a "Buy" flow now runs
  all the way to its review step instead of stopping at the amount screen.
- A sheet reached from several flows (a shared "confirm" or "execute" overlay) appears once, at
  the screen they share, instead of being dropped or duplicated.
- A journey reachable from more than one section (e.g. "Adding money" from both Home and a tab)
  shows up under each section, but is **named once** — its name is now authored against the
  flow's first distinctive screen, not its last. A churning end screen (a promo, a freshly added
  confirmation) no longer detaches a flow's name.

### Breaking

- `overrides.flowNames` is now keyed by a flow's **name key** — its first distinctive screen
  (`steps[1]`, or the launch screen for a one-step hub) — instead of its goal/anchor node. The
  new key is surfaced as `nameKey` in each `view.namingTODO` entry. Existing `flowNames` authored
  against the old goal-based keys must be re-keyed (the two shipped captures already are).
- Some flow routes change as a result of the structural rework (a flow's slug follows its name;
  flows that were artifacts of the old completion-path heuristic are gone, and previously dropped
  journeys now appear).

### For contributors

- `lib/packager/segment.ts` is rewritten around a **dominator tree** of the nav/overlay subgraph
  (virtual super-source → anchors; iterative Cooper–Harvey–Kennedy idom). It replaces the
  BFS-distance proxy and its compensations (`isSideTarget`, `leadsOnward`, `reachesHub`,
  `shortestToHub`, the separate feature-vs-completion regimes). `idom(X)` is X's parent; a chain
  is a trunk, a node dominating ≥ 2 onward children is a hub. Return-to-launcher **excursions**
  are detected structurally and held out of flows (woven back as picker steps in the next stage);
  **cross-section** journeys are re-emitted under each reaching section rather than hoisted to the
  common dominator. The fixpoint is order-independent — determinism is preserved.
- `lib/packager/naming.ts` adds `nameKeyOf(journey)` (the trunk-based name key) and looks up
  `overrides.flowNames` by it; `view.namingTODO[].nameKey` is additive.
- Stage 4 of `docs/flow-segmentation-redesign.md`; built before Stage 3 (it removes the machinery
  Stage 3 would otherwise have to patch). `README.md` and the `app-capture` schema doc updated.

## [2.2.0] - 2026-06-24

### Changed

- Flows now list a screen's choices in the order the app presents them. A branching screen's
  sub-flows follow its authored decision-point options (Settings' sub-pages read top-to-bottom
  as the app lists them — Verify identity, Account handle, Privacy, … — instead of alphabetically),
  falling back to the order they were walked, then by name, so the result stays stable.

### For contributors

- `lib/packager/segment.ts`: sibling ordering is now keyed by the parent's `decisionPoints`
  option order (canonicalized and threaded in from `index.ts`), then edge `observedAtStep`, then
  lexical id — replacing the BFS-distance sort. Membership is unchanged; only sibling order moves.
- Continues the segmentation rework in `docs/flow-segmentation-redesign.md` (Stage 2). Unexplored
  decision-point options keep surfacing as labeled stubs in `view.decisionPoints`.

## [2.1.0] - 2026-06-24

### Added

- Flow names are drafted from the whole journey. The naming hand-off (`namingTODO` in a
  capture's `view.json`) now carries every step's screen id and title, so a flow is named from
  its full path — "Withdraw to bank account" from `withdraw → add-payee → add-payee-bank` —
  rather than from a single screen.
- The build surfaces two capture gaps it used to hide. A main-navigation section the walk never
  went past (a tab you opened but did not explore) is listed in `view.uncapturedSections`, and
  `pnpm build-data` prints a warning to go capture it — instead of the section silently
  disappearing from Flows. A flow whose path was cut by the internal length cap is counted in
  `view.stats.truncatedFlows`, also with a warning.

### Changed

- Long onboarding-style flows can run to 20 steps before being split (the internal trunk cap was
  14).
- Journeys built from sheets/overlays — a buy or swap made entirely of bottom-sheets — are no
  longer mistaken for dead-ends, so they package as complete flows.

### For contributors

- `lib/packager/segment.ts`: `MAX_TRUNK` 14→20 with `SegmentResult.truncated`; empty main-nav
  sections reported as `SegmentResult.emptyNavRoots`; `leadsOnward` now counts `overlay` edges,
  not just `nav`.
- `lib/packager/index.ts` / `types.ts`: additive view fields `stats.truncatedFlows`,
  `uncapturedSections`, and `namingTODO[].steps`. Mechanical flow naming stays a simple
  `steps[1]`/goal fallback — real names come from the LLM/human via `overrides.flowNames`.
- A design note for the broader segmentation rework (Stages 2–4, not yet implemented) lives at
  `docs/flow-segmentation-redesign.md`.

## [2.0.1] - 2026-06-23

### Fixed

- A shared or copied link to a flow step now matches the number on the card:
  `?step=1` is the first screen. The deep-link value used to start at `?step=0`,
  one less than the step badge you see in the viewer.
- A flow link with an out-of-range or garbage `?step` (a stale link, or a step
  that no longer exists after a re-capture) now opens at the first step and
  removes the `?step` from the URL, instead of jumping to the last step and
  leaving the broken value in the address bar.

## [2.0.0] - 2026-06-22

Every capture now has one address, and it always shows the date. Opening an app takes you to
`/apps/<app>/<date>` — the most recent capture by default — and that dated URL is the page you
share, bookmark, or refresh, for the gallery and for any single screen or flow inside it. A link
you copy keeps pointing at the exact capture you copied it from, even after a newer one lands,
because there's no longer a separate undated "latest" URL that quietly moves. The bare
`/apps/<app>` still works: it now just forwards you to the latest dated capture.

### Breaking changes

- The undated per-app and per-entity URLs are gone. `/apps/<app>` is now a redirect (307) to
  `/apps/<app>/<latest>`, and the only screen/flow links are the dated ones —
  `/apps/<app>/<date>/screen/<id>` and `/apps/<app>/<date>/flow/<slug>`. Old undated links such
  as `/apps/<app>/screen/<id>` or `/apps/<app>/flows` no longer resolve (these were only ever on
  an unreleased branch, so no shipped link breaks).

### For contributors

- The two mirrored route trees collapsed into one. The dated tree under
  `app/apps/[slug]/[date]/` is now the single canonical tree (gallery `(gallery)/`, `@modal`
  intercept slot, and standalone `screen`/`flow` pages); the old undated tree under
  `app/apps/[slug]/` was deleted. `app/apps/[slug]/page.tsx` is a new prebuilt static 307 to the
  latest date (`dynamicParams = false` + `generateStaticParams = staticAppParams`, target baked
  from `app.latest`); `app/apps/[slug]/opengraph-image.tsx` stays as the inherited app-level OG
  route.
- `lib/links.ts` lost its latest-vs-dated split: `captureBase` / `screenHref` / `flowHref` /
  `flowsHref` are now all always-dated and dropped their `latest` parameter; `appHref`,
  `dateHref`, `screenShareHref`, and `flowShareHref` were removed (the share helpers folded into
  the now-identical dated builders). `lib/captures.ts` replaces `staticDateParams` with
  `staticCaptureParams` (every date, including the latest); `staticAppParams` stays for the
  redirect. `CaptureContext.latest` / `AppIndex.latest` stay — `latest` is still the redirect
  target, the date display, and the resolve-the-latest invariant. The viewers and app-detail
  components dropped their `latest` and `pinnedDate` props throughout, and the browse cards link
  straight to `captureBase(app.slug, app.latest)`.
- The dated screen/flow standalone pages keep `generateStaticParams = []` (nothing prebuilt —
  every screen/flow renders on demand and then caches). The flow page's `?step` deep-link is read
  on the client (in `FlowViewer`) rather than from `searchParams` on the server, so the page never
  touches request-time input and stays cacheable like the screen page (no `force-dynamic`). The
  `@modal` flow intercept likewise no longer reads `searchParams`.

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
