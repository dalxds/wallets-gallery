# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Wallets Gallery is a Next.js 16 / React 19 site (deployed on Vercel) that publishes **captured
mobile-app UI flows**. Each capture is a committed `graph.json`; everything the site shows is
derived from it by a pure, deterministic packager (`lib/packager/`). Gallery pages are
prerendered (SSG); individual screen/flow pages, their OG cards, and image optimization happen
on demand.
`README.md` is the canonical architecture and capture-model doc — read it before working on
the packager, the build scripts, or capture data. The on-disk data contract lives in
`.claude/skills/app-capture/references/schema.md` (with a TypeScript mirror in
`lib/packager/types.ts`).

## Commands

- **pnpm**, not npm/yarn. TypeScript build scripts run on Node natively (`node scripts/x.ts`,
  Node ≥ 22) — there is no ts-node step.
- `pnpm build-data` — regenerate every `view.json` + `index.json` from `graph.json`. This is
  the fast inner loop after editing a graph or the packager; `pnpm build` runs `build-data`
  then `next build` (Vercel-native: gallery prerendered, screen/flow pages + OG on demand).
- `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (eslint), `pnpm test` (vitest).
- Single test: `pnpm test <file>` or `pnpm exec vitest run -t "<name>"`. Tests live in
  `tests/`, not beside source.

## App vs. captures

Treat these as two separate things:

- **The app** — the site and engine: `app/`, `components/`, `lib/`, `scripts/`. App changes
  are _releases_ — they get a version bump and a `CHANGELOG.md` entry (see below).
- **The captures** — the data under `public/captures/**`. `graph.json` and `app.json` are
  committed source; `view.json` and `index.json` are generated. Adding or updating a capture
  is a _content update_ — it does **not** bump the version or get a CHANGELOG entry.

## Versioning & CHANGELOG

- The app version is the `version` field in `package.json` (3-segment SemVer). Bump by the
  **scale** of the change, not the file count: PATCH = bug fix or small additive change;
  MINOR = a new capability (a packager stage, a UI surface, a build step) or a substantial
  refactor; MAJOR = a breaking change to the data contract (graph/view schema, `overrides`
  keys) or the published routes.
- Every app release gets a `CHANGELOG.md` entry. Lead with what a user can now do, use plain
  language, keep branch/process narrative out, and put contributor notes under
  "For contributors". See `CHANGELOG.md` for the format and voice rules.

## Editing rules

- **Never hand-edit generated files.** `view.json` and `index.json` are build artifacts. To
  change what they contain, edit the source `graph.json` (its `overrides` block is the only
  hand-editable surface) and re-run `pnpm build-data`.
- **The packager must stay pure and deterministic** — no clock, no randomness, no
  input-order dependence: reordering the nodes/edges arrays must not change the view. After
  any packager or graph change, run `pnpm build-data` and `pnpm test` (the `tests/packaging/`
  suite pins these invariants).
- **`lib/packager/` and `scripts/` are intentionally prettier-off** (dense hand-formatted
  style; see `.prettierignore`). Don't run `prettier --write` on individual files there.
  `pnpm format` is safe — it respects `.prettierignore`.
- **Captures are isolated.** When producing or editing capture data, never read another app's
  files as a reference (only a re-capture reads this app's own latest graph, to carry
  `overrides` forward).
- **Don't reintroduce `output: "export"`.** The site is Vercel-native; that flag would disable
  `next/image` optimization, on-demand OG (`opengraph-image.tsx` via `lib/og.tsx`), and the
  intercepting-route lightbox modals (`app/apps/[slug]/[date]/@modal/`). Screen/flow deep links
  are real routes built through `captureBase` in `lib/links.ts`. Leak prevention is `.vercelignore`
  (not the removed `prune-export`): it keeps `_staging/`, `credentials.md`, and `*.snap.json`
  out of the deploy; `*.snap.json` are gitignored.
- **Every capture is canonical at its dated URL — one route tree.** A capture lives at
  `/apps/[slug]/[date]` (Screens) and `/apps/[slug]/[date]/flows` (Flows); its screens and flows
  at `/apps/[slug]/[date]/screen/[id]` and `…/flow/[slug]`. `captureBase` in `lib/links.ts` is
  **always dated** — there is no separate "clean latest" form. The bare `/apps/[slug]` is a
  prebuilt static 307 to the latest date (`app/apps/[slug]/page.tsx`); don't give it a gallery.
  Don't reintroduce the clean per-entity routes or a `latest → clean` branch in the link helpers.
- **The Screens/Flows tabs are routes, not client state.** Each is its own prerendered page
  under the `(gallery)` route group inside `[date]/` — `/apps/[slug]/[date]` (Screens) and
  `/apps/[slug]/[date]/flows` (Flows) — with the shared chrome in `[date]/(gallery)/layout.tsx`
  (`GalleryFrame`), so a tab switch is a prefetched soft-nav that swaps only the panel beneath.
  `TabBar` is `<Link>`s with `usePathname()` for the active state; the `@modal` slot intercepts a
  screen/flow click over either tab. Don't reintroduce a client-held tab or a `?tab` param — a
  route keeps each tab SSG, prefetched, and shareable, and avoids the modal-route state leaks
  the old client tab had.

## Code style

- Prettier: no semicolons, double quotes, 2-space indent, `printWidth` 80, ES5 trailing
  commas. TypeScript `strict`. Import via the `@/*` alias (e.g. `@/lib/utils`), not deep
  relative paths.
- UI is shadcn/ui (style: radix-vega) on Tailwind v4; icons from `lucide-react`.

## Commits

- **Conventional Commits** (`feat:`, `fix:`, `refactor(scope):`, `chore:`, …).
- Make the app/captures split visible: app changes use the fitting type; a capture content
  update uses `content(<app-slug>):` (e.g. `content(tuyo): refresh 2026-06-17 capture`).
- After a graph or packager change, run `pnpm build-data` and **commit the regenerated
  `view.json` / `index.json` alongside the source edit** so git and the data stay in sync.
