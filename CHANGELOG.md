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
