# Wallets Gallery

A gallery of **captured mobile-app UI flows** — crypto-wallet and fintech apps, explored
on a device, recorded as a graph, and published as a fast site you can browse by screen or
by flow.

The interesting part of this repo is not the website; it's the **capture model**. Each app
is walked once, its screens and transitions are written down as a graph, and everything the
gallery shows — merged screens, named flows, state variants, replay scripts — is _derived
deterministically_ from that one graph. This README describes both: how the repo is laid
out, and how captures actually work.

> This README **describes the codebase**. The rules for working in it — editing discipline,
> the determinism contract, commit and versioning conventions — live in
> [`CLAUDE.md`](CLAUDE.md).

```mermaid
flowchart LR
  walk["📱 device walk"] -->|"observe"| wj["walk.json<br/>raw observation"]
  wj -->|"assemble.ts"| gph["graph.json<br/>committed source"]
  gph -->|"packageGraph()"| view["view.json<br/>derived"]
  view -->|"next build"| gallery["the gallery<br/>screens · flows"]
```

---

## Table of contents

1. [What it is](#what-it-is)
2. [Quick start](#quick-start)
3. [Repository layout](#repository-layout)
4. [The capture model](#the-capture-model) — nodes, edges, graphs, decision points
5. [Identity signals](#identity-signals) — how two screenshots become "the same screen"
6. [From graph to view: the packager](#from-graph-to-view-the-packager)
7. [Overrides: the one hand-edited surface](#overrides-the-one-hand-edited-surface)
8. [The build pipeline](#the-build-pipeline)
9. [Routes & rendering](#routes--rendering)
10. [Capturing a new app](#capturing-a-new-app)
11. [Architecture notes](#architecture-notes)

---

## What it is

- **The app** — a Next.js 16 / React 19 site (Tailwind v4 + shadcn/ui) deployed on Vercel.
  The home and per-capture gallery pages are prerendered from JSON on disk (SSG); individual
  screen/flow pages and their Open Graph cards render on demand and cache; screenshots are
  optimized on demand by `next/image`. No external data fetches — everything derives from
  local JSON.
- **The data** — under `public/captures/`, one directory per app. Each capture is a
  `graph.json` (the committed source of truth) plus a `view.json` (generated).
- **The engine** — `lib/packager/`, a pure, deterministic transform `package(graph) → view`.
  Same `graph.json` in, byte-identical `view.json` out, every time.
- **The capture agent** — `.claude/skills/app-capture/`, the playbook an agent follows to
  walk an app on a device and produce a `graph.json`. (You don't need it to understand or
  run the site; it's how new data gets made.)

The mental model in one line — and the diagram at the top of this README:

```
observe a walk  →  assemble a graph  →  derive a view  →  render the gallery
```

---

## Quick start

This repo uses **pnpm**, and runs its TypeScript build scripts directly with `node`
(Node ≥ 22 executes `.ts` natively — no ts-node).

```bash
pnpm install

pnpm dev          # next dev (turbopack) — local dev server
pnpm build-data   # regenerate every view.json + index.json (the registry) from graph.json
pnpm build        # build-data → next build (gallery prerendered; long-tail on demand)
pnpm start        # next start — run the production server locally
pnpm test         # vitest (unit + packager tests)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

`pnpm build` is the full pipeline; `pnpm build-data` is the fast inner loop when only a
`graph.json` or the packager has changed.

---

## Repository layout

```
app/                          # Next.js App Router (gallery prerendered; screen/flow on demand)
  page.tsx                    #   /            browse grid (reads public/captures/index.json)
  opengraph-image.tsx         #   site OG card
  apps/[slug]/                #   /apps/x      static 307 → /apps/x/<latest> (page.tsx)
    opengraph-image.tsx       #     app-level OG card (inherited route)
    [date]/                   #   /apps/x/<date>   the one canonical capture tree
      layout.tsx              #     hosts the @modal parallel slot over the gallery
      (gallery)/page.tsx      #     Screens tab · (gallery)/flows/page.tsx for the Flows tab
      @modal/(.)screen · (.)flow #  intercepting-route modals (lightbox over the gallery)
      screen/[id] · flow/[slug]  #  standalone pages + opengraph-image.tsx (shared-link / SEO)
      graph.json · view.json/route.ts # /apps/x/<date>/graph.json·view.json (raw capture data)
    graph.json · view.json/route.ts  # /apps/x/graph.json·view.json → 307 to the latest date
    app.json/route.ts           #     /apps/x/app.json     per-app metadata (raw JSON)
  index.json/route.ts           #   /index.json  the app registry (raw JSON)
  llms.txt/route.ts           #   /llms.txt    machine-readable index of apps + data URLs

components/
  app-detail/                 # the per-app detail UI (tabs, screen grid, flow rows)
  browse/                     # the browse grid + sort control
  lightbox/                   # screen + flow lightboxes + their route-driven modal wrappers
  standalone/                 # full-page screen/flow views (shared-link / OG targets)
  shared/  layout/  ui/       # image actions; app shell + header; shadcn primitives

lib/
  packager/                   # ★ THE ENGINE — graph → view (see below). Pure, deterministic.
    types.ts                  #   the full type contract for graph + view (read this first)
    index.ts                  #   packageGraph(graph): View  — orchestrates the transform
    identity.ts               #   fingerprint / skeletonHash / pHash primitives
    saf.ts                    #   Screen Abstraction Function: merge + cluster raw nodes
    classify.ts               #   screen-state labels + in-place toggle detection
    segment.ts                #   journey segmentation: build the flow tree
    naming.ts  replay.ts      #   flow names; inline .ad replay scripts
    graph.ts  validate.ts     #   adjacency helpers; graph.json validator
  types.ts                    # app-facing types (aliased over the packager's View) + registry/manifest
  captures.ts                 # server-only reads of index.json + view.json (shared by all routes)
  links.ts  states.ts         # route/deep-link helpers (captureBase); state switcher presentation
  images.ts  og.tsx           # screenshot URL + dims; Open Graph card renderers
  clipboard.ts  site.ts  utils.ts # copy-link/image/download; site URLs (assetBaseUrl); cn() helper

scripts/                      # build-time CLIs (intentionally prettier-off, dense style)
  assemble.ts                 #   walk.json → graph.json  (computes identity signals, validates)
  package.ts                  #   graph.json → view (CLI wrapper around the packager, for the skill)
  build-data.ts               #   every graph.json → view.json + index.json (the registry)
  phash.ts                    #   dependency-free perceptual hash of a PNG

public/captures/              # ★ THE DATA
  index.json                  #   generated registry (browse page reads this)
  <app-slug>/
    app.json                  #   manifest: metadata + capture history + latest pointer
    assets/<sha>.png|.snap.json  # content-addressed screenshots + raw snapshots (deduped)
    <YYYY-MM-DD>/
      graph.json              #   ★ the capture — source of truth (committed)
      view.json               #   generated by the packager (build artifact)
    _staging/                 #   gitignored working dir from the capture walk

.claude/skills/app-capture/   # the capture agent's playbook (how graph.json is produced)
tests/                        # vitest: lib utils + tests/packaging/ (assemble, classify, packager)
```

---

## The capture model

A **capture** is one independent observation of one app at one moment, recorded as a
directed graph. There are exactly four kinds of thing in it: **nodes** (screen states),
**edges** (transitions), **decision points** (branches), and the **graph** that holds them.

```mermaid
flowchart TD
  welcome["welcome"] -->|"Get started · nav"| login["login"]
  login -->|"Sign in · nav"| home["home"]
  login -->|"Forgot password? · nav"| forgot["forgot-password"]
  home ==>|"Send · overlay"| send["send sheet"]
  home -.->|"hide balance · in-place"| homeHidden["home · balance hidden"]
```

<sub>A toy capture. Solid arrows are `nav` (a different screen); the thick arrow is an
`overlay` (a sheet over the prior screen); the dotted self-return is an `in-place` state
toggle. The packager turns this into merged screens, a flow tree, and replay scripts.</sub>

### Node — a screen state

A `GraphNode` is **one screen in one state**. Not "the trade screen" abstractly — _this_
trade screen, with these texts and these buttons. (Two states of the trade screen — empty
vs. funded — are two nodes; the packager decides later whether to merge or group them.)

```jsonc
{
  "id": "welcome",                              // stable, agent-assigned, human-readable
  "fingerprint": "sha256:9cade6c83b260617d82a1dcf",  // exact identity (see Identity signals)
  "skeletonHash": "sk:7c6bc5a2d1a968f1dea04382",     // structure-only identity
  "pHash": "p:0d782bfea1a1f603",                     // perceptual hash of the screenshot
  "role": "other",                              // home|list|picker|form|confirmation|auth|modal|settings|error|other
  "screenshotPath": "assets/cd4f6196b531.png",  // content-addressed PNG
  "snapshotPath": "assets/2919a41502e7.snap.json",   // raw accessibility snapshot (or null)
  "texts": ["The card that might not charge you", "Get started", ...],
  "interactiveElements": [
    { "label": "Get started", "role": "button", "selector": "label=\"Get started\"", "emphasis": "primary" },
    { "label": "I have a referral code", "role": "button", "selector": "label=\"I have a referral code\"" }
  ]
}
```

- **`texts`** — the visible copy on the screen. Used for screen titles and state labels.
- **`interactiveElements`** — the hittable controls. `emphasis: "primary"` tags the screen's
  main call-to-action (`"secondary"` for a notable alternate). Emphasis is presentation only
  — it does **not** affect identity.
- **`role`** — a coarse screen category, used by segmentation (e.g. `home` screens are
  _completion hubs_; see below).

### Edge — a transition

A `GraphEdge` is a directed transition between two nodes: "from this screen, this action got
me to that screen."

```jsonc
{
  "from": "login",
  "to": "forgot-password",
  "action": "Tap \"Forgot password?\"", // human-readable
  "selector": "label=\"Forgot password?\"", // how to re-trigger it (drives replay), or null
  "kind": "nav", // nav | overlay | in-place | back
  "observedAtStep": 3, // walk order; deterministic tie-break
}
```

`kind` is the load-bearing field:

| kind       | meaning                                                           | how it's set                                      |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| `nav`      | navigated to a **different** screen                               | derived: `from`/`to` have **different** skeletons |
| `in-place` | same screen, **changed state** (a "Max" toggle, a carousel swipe) | derived: `from`/`to` share a `skeletonHash`       |
| `overlay`  | a sheet/modal opened **over** the prior screen                    | recorded by the agent (skeletons can't see it)    |
| `back`     | pressed the system/back affordance                                | recorded by the agent                             |

The crucial one is **`in-place`**: an edge between two variants of _one logical screen_ is the
deterministic signal that this is a **state toggle**, not a navigation step. The packager
folds those variants into an on-step state switcher instead of making each its own flow step.
`nav` vs `in-place` is **derived from skeleton equality** at assemble time — the agent never
guesses it; it only records what skeletons can't detect (`back`/`overlay`).

### Decision point — a branch

A `DecisionPoint` records that a screen offers a real choice, and which options were explored:

```jsonc
{
  "nodeId": "login",
  "options": [
    { "label": "Sign in", "explored": true, "toNode": "home" },
    {
      "label": "Forgot password?",
      "explored": true,
      "toNode": "forgot-password",
    },
  ],
}
```

These surface in the UI as "this screen branches" and link each option to the flow it leads to.

### Graph — the whole capture

```jsonc
{
  "meta": { "schemaVersion": 2, "app": {...}, "captureDate": "2026-06-05", "scope": "initial", ... },
  "root": "welcome",                  // the launch node (BFS root of the walk)
  "mainNav": ["home", "earn", ...],   // optional: top-level sections (tab bar / nav rail / drawer)
  "nodes": [ ... ],
  "edges": [ ... ],
  "decisionPoints": [ ... ],
  "overrides": { ... }                // the ONLY hand-edited block (see below)
}
```

- **`root`** is where the walk started; segmentation roots the flow tree here.
- **`mainNav`** lists the node each persistent main-nav item lands on. Each becomes a
  **top-level flow that roots its own subtree** instead of nesting under whatever launched it
  — so "Settings" is a peer section, not a child of "Home".

That's the entire on-disk contract. Everything the gallery shows is computed from it.

---

## Identity signals

The hard problem in a capture is **"are these two screenshots the same screen?"** A list with
3 rows and the same list with 4 rows are the same screen; an empty wallet and a funded wallet
are arguably the same screen in two _states_; the trade screen and the settings screen are
not. The graph carries **three** orthogonal signals per node so the packager can answer this
deterministically. All three are computed by `scripts/assemble.ts` (via `lib/packager/identity.ts`
and `scripts/phash.ts`) at capture time — never hand-written, never recomputed by the packager.

| Signal             | What it hashes                                           | Answers                                                             |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **`fingerprint`**  | sorted `(role, label)` pairs of the interactive elements | "exactly the same controls?" — exact identity                       |
| **`skeletonHash`** | structure only — element **roles**, labels/text stripped | "same _shape_ of screen?" — clusters variants of one logical screen |
| **`pHash`**        | a 64-bit perceptual hash of the screenshot pixels        | "do these look nearly identical?" — near-duplicate backstop         |

Why three? Because each fails differently:

- **`fingerprint`** is too strict for merging — a "Send" button labelled with the recipient's
  name differs from one labelled with another's, yet it's the same screen. It's the canonical
  _exact_ identity (and the replay entry check).
- **`skeletonHash`** strips the volatile labels so "…purchase of VIRTUAL" and "…purchase of
  ETH" share one hash. It's deliberately _coarse_ — many unrelated screens can collide on the
  element-role multiset — so it is never trusted alone for merging. It's also **load-bearing
  beyond merging**: the same hash drives clustering _and_ the `in-place` edge derivation at
  assemble time.
- **`pHash`** compares actual pixels. `pHashDistance` (Hamming distance) guards a merge: two
  nodes that share a skeleton are only collapsed when their pixels are within `T_MERGE_PHASH`
  (6/64 bits) — tight enough to reject genuinely different same-skeleton screens.

When a screen has no usable screenshot (a secure/`FLAG_SECURE` screen) or no interactive
elements, the signals degrade gracefully: a `sha256-text:` fingerprint over the screen's
texts, a `skt:` text-shape skeleton, and a `null` pHash. Dynamic content (money amounts,
`@handles`, timestamps, hex addresses, bare numbers, percentages) is normalized to typed
placeholders (`{money}`, `{handle}`, …) before hashing so data churn doesn't fragment identity.

---

## From graph to view: the packager

`lib/packager/index.ts → packageGraph(graph): View` is the heart of the system. It is a
**pure, deterministic** function: no I/O, no randomness, no clock — the same graph always
produces the same view. It runs five stages in order.

```mermaid
flowchart LR
  g["graph.json"] --> s1["1 · SAF<br/>merge + cluster"]
  s1 --> s2["2 · classify<br/>states + toggles"]
  s2 --> s3["3 · segment<br/>flow tree"]
  s3 --> s4["4 · naming<br/>+ namingTODO"]
  s4 --> s5["5 · replay<br/>.ad scripts"]
  s5 --> v["view.json"]
```

The five stages, in words: SAF merges data-dupes into canonical nodes and clusters states into
logical families; classify labels each state and detects in-place toggles; segment walks the
edges into a tree of flows; naming gives each flow a mechanical name (plus a `namingTODO` for a
human/agent to improve); replay emits an inline `.ad` command script per flow. The result is
`view.json`: `screens[]` · `flows[]` (a tree) · `decisionPoints[]` · `stats` · `namingTODO`.

### 1. SAF — the Screen Abstraction Function (`saf.ts`)

Two distinct operations collapse the raw observed nodes into logical screens:

- **MERGE** — nodes that are _the same screen state_, differing only in dynamic data (3 rows
  vs 4, one token name vs another). Collapsed via union-find into **one canonical node**.
  Signal: equal skeleton **and** equal dynamic-normalized text, **or** equal skeleton **and**
  near-identical pHash (≤ 6 bits). This is where "list with N rows" stops being N screens.
- **CLUSTER** — canonical nodes that are _the same logical screen in a genuinely different
  state_ (home empty vs. funded, trade vs. trade-at-max). Kept as **distinct** nodes but
  grouped into a **family**. Signal: **skeleton equality only** — a true equivalence relation.
  Cross-skeleton state variants are grouped explicitly via `overrides.stateGroup` instead.

```mermaid
flowchart TD
  A["two observed nodes"] --> B{"same skeletonHash?"}
  B -->|"no"| D["distinct screens"]
  B -->|"yes"| C{"same normalized text,<br/>or pHash within 6 bits?"}
  C -->|"yes"| M["MERGE<br/>one canonical node"]
  C -->|"no"| G["CLUSTER<br/>same family · different state"]
```

The richer node (most elements, then most texts, then lexically-smallest id) wins as the
representative — deterministically.

### 2. classify — states & toggles (`classify.ts`)

For each family, every member gets a **state label** — `default` / `empty` / `loading` /
`error` / `max` — read from its texts by narrow, generic regexes (these are UI-state words,
not app vocabulary). Then it detects **in-place toggles**: members joined to the family
default by a _chain_ of `in-place` edges are the same screen in a different
data/condition. They fold into the default's **`stateGroup`** and render as an on-step state
switcher rather than separate navigation steps. (The chain matters: a carousel's slide 3
connects through slide 2, never directly to the default.)

### 3. segment — the flow tree (`segment.ts`)

The flow tree **is the dominator tree** of the app's nav/overlay subgraph. `idom(X)` — the one
screen every path to `X` must pass through — is `X`'s parent, so a journey nests under whatever
you must go through to reach it ("Send" under "Home", "Privacy" under "Settings", "Buy" under an
asset detail). A chain in the dominator tree (each screen dominating exactly one onward child) is
a **trunk**; a screen dominating ≥ 2 onward children is a **hub** whose children each start a
child flow.

```mermaid
flowchart TD
  home["Home · root"] --> send["Send · trunk"]
  home --> settings["Settings · hub"]
  settings --> verify["Verify identity"]
  settings --> handle["Account handle"]
  settings --> privacy["Privacy"]
  asset["Asset detail · hub"] --> buy["Buy → review"]
```

<sub>A slice of a resulting flow tree. `Settings` and `Asset detail` are hubs (≥ 2 onward
children); `Send` is a one-child trunk; `Home` is an anchor that roots its own subtree.</sub>

- **Anchors** root their own top-level subtree: a virtual super-source dominates them, so their
  `idom` is the super-source. Three sources, unioned — entry points (the launch root + screens
  nothing navigates to), **completion hubs** (home/launch screens), and **main-nav roots**
  (`graph.mainNav`). A main-nav section is a peer, not a child of whatever launched it.
- **Excursions** — a picker/peek sheet launched from a trunk screen that only pops back to it —
  dominate nothing and return to their dominator. They are not branches (they must not shatter
  the trunk) and are woven in as inline **picker steps**, not their own flow.
- **Sheets are steps.** A forward-only sheet (a confirmation/info overlay with no return) is a
  dominated leaf, so it is a normal step. A sheet reached from several flows lands at their
  common dominator — emitted once there, never duplicated into each.
- **Cross-section journeys** (reachable from N sections, e.g. "Adding money" from both Home and
  Earn) would hoist to the super-source; instead a copy is re-emitted under **each** reaching
  section. The dominator tree governs trunk/nesting shape, not dedup-by-hoisting.

Sibling order follows the parent's authored `decisionPoints` option order, then the observed-walk
order, then lexical id. The iterative dominator fixpoint is order-independent (it computes a
property of the graph), so the whole pass is deterministic. The result is a tree of journeys,
each with an ordered list of step nodes.

### 4. naming (`naming.ts`)

Each flow gets a **mechanical** name derived from its first distinctive screen's title (trailing
parentheticals like "(Owned)" stripped — those describe the screen, not the intent). Mechanical
names land in **`namingTODO`** so the capture agent (or a human) can supply a real name, which
persists in `overrides.flowNames` keyed by the flow's **name key** (`nameKey` in `namingTODO`).
The name key is the flow's first distinctive screen (`steps[1]`, or the launch screen for a
one-step hub) — the stable entry side, decoupled from the routing slug. So cross-section copies
share one authored name, and a churning goal/last screen no longer detaches it.

### 5. replay (`replay.ts`)

For each flow, the woven step plan's edge selectors are compiled into an inline **`.ad` command
script** (`open <bundleId>`, then `click <selector>` per step) with a confidence rating from
the selector quality (`id=` > `label=`/`role=` > positional). A woven **picker** step expands to
two clicks — open the picker from its launcher, then make the selection that returns to it —
before the spine continues. This is what lets a flow be _re-run_ on a device, not just viewed.

### The result: `view.json`

```jsonc
{
  "app": {...}, "captureDate": "...",
  "screens": [ /* one per canonical node, with state/stateGroup + which flows it appears in */ ],
  "flows":   [ /* the journey tree: slug, name, parent, ordered steps (each step has a
                  kind: "forward" | "picker"), replay */ ],
  "decisionPoints": [ ... ],
  "stats": { "screens": N, "rawNodes": M, "flows": F, "topLevelFlows": T, "replayCoverage": 87 },
  "namingTODO": [ /* each: { entryNodeId, nameKey, slug, mechanicalName, steps } */ ]
}
```

`view.json` is a **build artifact**: it is regenerated from the graph (and its `overrides`) by
the packager. To change anything in it, change the source — the graph's `overrides`.

---

## Overrides: the one hand-edited surface

The graph's observation (nodes/edges/decisionPoints) is written by the capture walk. The
**only** hand-editable block is `overrides`, written by the edit agent (or a person) and
**carried forward verbatim across re-captures**. Each key corrects exactly one thing the
packager derived:

| Key         | Shape                                                            | Corrects                                                        |
| ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `flowNames` | flow-id → name                                                   | the name of a derived flow                                      |
| `structure` | flow-id → `{ parent? }`                                          | re-parent a flow in the tree (`parent: null` pins it top-level) |
| `screens`   | node-id → `{ role?, title?, description?, state?, stateGroup? }` | a screen's facts, incl. forcing its state / group               |
| `merges`    | `string[][]`                                                     | force-merge nodes the SAF kept separate                         |
| `splits`    | `string[]`                                                       | force-keep nodes distinct that the SAF would merge              |

Regenerating with `pnpm build-data` (or `node scripts/package.ts <graph.json>`) applies them.
Because everything is derived, an override is a small, reviewable correction — not a rewrite
of the output.

---

## The build pipeline

```mermaid
flowchart TD
  walk["device walk"] --> wj["_staging/walk.json<br/>raw observation"]
  wj -->|"scripts/assemble.ts"| g["graph.json<br/>committed source"]
  g -->|"scripts/build-data.ts"| v["view.json<br/>+ captures/index.json"]
  v -->|"next build"| pages["gallery prerendered (SSG)<br/>screen · flow · OG on demand"]
  pages -->|".vercelignore allowlist"| deploy["Vercel deploy<br/>captures/ = screenshots only;<br/>JSON via /index.json + /apps routes"]
```

Key properties:

- **`graph.json` is the only committed source per capture.** `view.json` and `index.json` are
  derivable build artifacts, generated by `build-data` and committed in sync with their source.
- **Routes are data, not fetches.** The browse grid and every `/apps/<slug>/<date>` gallery are
  prerendered from JSON on disk for each known date (SSG); the bare `/apps/<slug>` is a prebuilt
  static 307 to the latest, and unknown dates 404 (`dynamicParams = true`). Screen/flow pages and
  their OG cards render on the first request and cache (`generateStaticParams` returns `[]`, so the
  long tail never inflates the build). Either way there are **no external data fetches** —
  everything derives from local JSON. The route tree itself is laid out under
  [Routes & rendering](#routes--rendering).
- **The raw capture data is published through app routes.** The registry is at `/index.json`;
  per-app metadata at `/apps/<slug>/app.json`; and `/apps/<slug>/<date>/graph.json` · `/view.json`
  serve each capture's bytes verbatim — all prerendered (force-static, baked into the build
  output). `/apps/<slug>/graph.json` · `/view.json` 307 to the latest date. The screenshots are
  the only thing still served statically, at `/captures/<slug>/assets/<hash>.png`.
- **Leak prevention is `.vercelignore`, an allowlist.** With `public/` served as-is on Vercel,
  `public/captures/` ships only the screenshot PNGs — all capture JSON (`index.json`, `app.json`,
  `graph.json`, `view.json`) is served through the route handlers above instead, and `*.snap.json`,
  `_staging/`, `credentials.md`, secrets, and OS/editor cruft stay out by default, so a new stray
  file type can't leak unless it's explicitly allowed. `*.snap.json` are also gitignored.

---

## Routes & rendering

Every capture is canonical at one **dated** URL. The bare `/apps/<slug>` is a static 307 to the
latest date; the gallery's Screens and Flows tabs are separate prerendered pages; a screen or
flow click opens a lightbox via an intercepting `@modal` route, and the same URL opened directly
(or refreshed) renders a standalone page with its own Open Graph card.

```mermaid
flowchart TD
  bare["/apps/[slug]"] -->|"static 307"| dated["/apps/[slug]/[date]"]
  dated --> screens["Screens<br/>(gallery)/page.tsx"]
  dated --> flows["Flows<br/>(gallery)/flows/page.tsx"]
  screens -.->|"tile click"| modal["@modal intercept<br/>lightbox over the gallery"]
  flows -.->|"tile click"| modal
  modal -.->|"open / refresh URL"| standalone["standalone page<br/>screen/[id] · flow/[slug] + OG card"]
```

- The **Screens/Flows tabs are routes**, each its own prerendered page under the `(gallery)`
  route group inside `[date]/`, sharing chrome via `[date]/(gallery)/layout.tsx` (`GalleryFrame`).
  A tab switch is a prefetched soft-nav that swaps only the panel beneath; `TabBar` is `<Link>`s
  using `usePathname()` for the active state.
- The **`@modal` slot** intercepts a screen/flow click over either tab into a lightbox; the
  lightbox and the standalone page share one body (`ScreenViewer` / `FlowViewer` in
  `components/lightbox/`).
- **Deep links are real routes**, built through `captureBase` in `lib/links.ts` (always dated), so
  a shared link keeps resolving to the same capture after a newer one lands.
- **Open Graph cards** render via `next/og` at the site, app, screen, and flow levels
  (`opengraph-image.tsx`, composed in `lib/og.tsx`, which fetches the content-addressed PNGs
  from the CDN rather than the function bundle).
- **The raw capture data is a route too.** `/index.json` (the registry), `/apps/<slug>/app.json`,
  and the `[date]/graph.json`·`view.json` handlers serve the bytes verbatim (force-static — baked
  at build); the un-dated `/apps/<slug>/graph.json`·`view.json` 307 to the latest, mirroring the
  bare-app redirect.

---

## Capturing a new app

New data is produced by the **app-capture skill** at `.claude/skills/app-capture/` — an agent
walks the app on an Android emulator or iOS device and records observations. The flow:

```
walk      → author _staging/walk.json   (raw observation: nodes + edges + decisionPoints)
assemble  → node scripts/assemble.ts _staging/walk.json {date}/graph.json
            (computes the 3 identity signals, content-addresses screenshots, finalizes edge
             kind from skeleton equality, validates — refuses to write on error)
package   → node scripts/package.ts {date}/graph.json
            (derives flows/states/tree/replay; prints a namingTODO to fill in)
edit      → write overrides into graph.json, re-run package
```

The agent authors **exactly one** file — `walk.json` — and supplies flow names; it never
hand-computes a hash, builds a flow, or classifies a state. The contract for what goes in
`walk.json`/`graph.json`/`app.json` lives in
[`.claude/skills/app-capture/references/schema.md`](.claude/skills/app-capture/references/schema.md);
`lib/packager/types.ts` is the engine's own copy of those types.

---

## Architecture notes

- **`lib/packager/` is types-only at the boundary.** `types.ts` is pure types (erased at compile
  time) so client components can import it; all runtime logic lives in the sibling modules, which
  import `node:crypto` and run only at build time / in the CLI.
- **`skeletonHash` is capture-time and load-bearing.** Computed once by `scripts/assemble.ts`, it
  drives merge, cluster, _and_ the `in-place` edge derivation; the packager never recomputes it.
- **App vs. captures are tracked separately.** The app (site, packager, scripts) is versioned in
  `package.json` with a `CHANGELOG.md` entry; captures under `public/captures/` are content,
  tracked by commit. The conventions for both — and the editing/determinism rules for the
  packager — live in [`CLAUDE.md`](CLAUDE.md) and [`CHANGELOG.md`](CHANGELOG.md).
