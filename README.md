# Inspo

A gallery of **captured mobile-app UI flows** — crypto-wallet and fintech apps, explored
on a device, recorded as a graph, and published as a fast static site you can browse by
screen or by flow.

The interesting part of this repo is not the website; it's the **capture model**. Each app
is walked once, its screens and transitions are written down as a graph, and everything the
gallery shows — merged screens, named flows, state variants, replay scripts — is *derived
deterministically* from that one graph. This README explains both: how the repo is laid
out, and how captures actually work.

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
9. [Capturing a new app](#capturing-a-new-app)
10. [Conventions & gotchas](#conventions--gotchas)

---

## What it is

- **The app** — a Next.js 16 / React 19 site (Tailwind v4 + shadcn/ui) that exports to
  fully static HTML (`output: "export"`). There is no server at runtime; the whole gallery
  is prerendered from JSON on disk and can be served from any CDN.
- **The data** — under `public/captures/`, one directory per app. Each capture is a
  `graph.json` (the committed source of truth) plus a `view.json` (generated).
- **The engine** — `lib/packager/`, a pure, deterministic transform `package(graph) → view`.
  Same `graph.json` in, byte-identical `view.json` out, every time.
- **The capture agent** — `.claude/skills/app-capture/`, the playbook an agent follows to
  walk an app on a device and produce a `graph.json`. (You don't need it to understand or
  run the site; it's how new data gets made.)

The mental model in one line:

```
observe a walk  →  assemble a graph  →  derive a view  →  render a static site
```

---

## Quick start

This repo uses **pnpm**, and runs its TypeScript build scripts directly with `node`
(Node ≥ 22 executes `.ts` natively — no ts-node).

```bash
pnpm install

pnpm dev          # next dev (turbopack) — local dev server
pnpm build-data   # regenerate every view.json + index.json (the registry) from graph.json
pnpm build        # build-data → next build (static export to out/) → prune-export
pnpm start        # serve the exported out/ directory
pnpm test         # vitest (unit + packager tests)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

`pnpm build` is the full pipeline; `pnpm build-data` is the fast inner loop when you've only
touched a `graph.json` or the packager.

---

## Repository layout

```
app/                          # Next.js App Router (all routes are statically prerendered)
  page.tsx                    #   /            browse grid (reads public/captures/index.json)
  apps/[slug]/[[...date]]/    #   /apps/x      latest capture · /apps/x/<date> historical
    page.tsx                  #     reads {slug}/{date}/view.json at build time
  apps/[slug]/app-detail.tsx  #     server-rendered detail: Screens tab + Flows tab
  llms.txt/route.ts           #   /llms.txt    machine-readable index of apps + data URLs

components/
  app-detail/                 # the per-app detail UI (tabs, screen grid, flow rows, lightboxes)
  browse/                     # the browse grid + sort/view controls
  lightbox/                   # screen + flow lightboxes
  layout/  ui/                # app shell + header; shadcn primitives

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
  links.ts  states.ts         # deep-link helpers; state presentation for the on-screen state switcher
  images.ts  utils.ts         # screenshot URL helper; cn() classname helper

scripts/                      # build-time CLIs (intentionally prettier-off, dense style)
  assemble.ts                 #   walk.json → graph.json  (computes identity signals, validates)
  package.ts                  #   graph.json → view (CLI wrapper around the packager, for the skill)
  build-data.ts               #   every graph.json → view.json + index.json (the registry)
  phash.ts                    #   dependency-free perceptual hash of a PNG
  prune-export.ts             #   allowlist-prune out/captures after export (no staging/secrets ship)

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
directed graph. There are exactly four kinds of thing in it.

### Node — a screen state

A `GraphNode` is **one screen in one state**. Not "the trade screen" abstractly — *this*
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
  *completion hubs*; see below).

### Edge — a transition

A `GraphEdge` is a directed transition between two nodes: "from this screen, this action got
me to that screen."

```jsonc
{
  "from": "login",
  "to": "forgot-password",
  "action": "Tap \"Forgot password?\"",   // human-readable
  "selector": "label=\"Forgot password?\"", // how to re-trigger it (drives replay), or null
  "kind": "nav",                            // nav | overlay | in-place | back
  "observedAtStep": 3                       // walk order; deterministic tie-break
}
```

`kind` is the load-bearing field:

| kind | meaning | how it's set |
|---|---|---|
| `nav` | navigated to a **different** screen | derived: `from`/`to` have **different** skeletons |
| `in-place` | same screen, **changed state** (a "Max" toggle, a carousel swipe) | derived: `from`/`to` share a `skeletonHash` |
| `overlay` | a sheet/modal opened **over** the prior screen | recorded by the agent (skeletons can't see it) |
| `back` | pressed the system/back affordance | recorded by the agent |

The crucial one is **`in-place`**: an edge between two variants of *one logical screen* is the
deterministic signal that this is a **state toggle**, not a navigation step. The packager
folds those variants into an on-step state switcher instead of making each its own flow step.
`nav` vs `in-place` is **derived from skeleton equality** at assemble time — the agent never
guesses it; it only records what skeletons can't detect (`back`/`overlay`).

### Decision point — a branch

A `DecisionPoint` records that a screen offers a real choice, and which options were explored:

```jsonc
{ "nodeId": "login", "options": [
  { "label": "Sign in", "explored": true, "toNode": "home" },
  { "label": "Forgot password?", "explored": true, "toNode": "forgot-password" } ] }
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
are arguably the same screen in two *states*; the trade screen and the settings screen are
not. The graph carries **three** orthogonal signals per node so the packager can answer this
deterministically. All three are computed by `scripts/assemble.ts` (via `lib/packager/identity.ts`
and `scripts/phash.ts`) — never hand-written.

| Signal | What it hashes | Answers |
|---|---|---|
| **`fingerprint`** | sorted `(role, label)` pairs of the interactive elements | "exactly the same controls?" — exact identity |
| **`skeletonHash`** | structure only — element **roles**, labels/text stripped | "same *shape* of screen?" — clusters variants of one logical screen |
| **`pHash`** | a 64-bit perceptual hash of the screenshot pixels | "do these look nearly identical?" — near-duplicate backstop |

Why three? Because each fails differently:

- **`fingerprint`** is too strict for merging — a "Send" button labelled with the recipient's
  name differs from one labelled with another's, yet it's the same screen. It's the canonical
  *exact* identity (and the replay entry check).
- **`skeletonHash`** strips the volatile labels so "…purchase of VIRTUAL" and "…purchase of
  ETH" share one hash. It's deliberately *coarse* — many unrelated screens can collide on the
  element-role multiset — so it is never trusted alone for merging.
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

```
graph.json
   │
   ├─ 1. SAF        merge data-dupes → canonical nodes;  cluster states → logical families
   ├─ 2. classify   label each state (default/empty/loading/error/max); detect in-place toggles
   ├─ 3. segment    walk the edges into a tree of flows (journeys)
   ├─ 4. naming     mechanical flow names (+ namingTODO for the agent/human to improve)
   └─ 5. replay     emit an inline .ad command script per flow
   ▼
view.json   →   screens[] · flows[] (tree) · decisionPoints[] · stats · namingTODO
```

### 1. SAF — the Screen Abstraction Function (`saf.ts`)

Two distinct operations collapse the raw observed nodes into logical screens:

- **MERGE** — nodes that are *the same screen state*, differing only in dynamic data (3 rows
  vs 4, one token name vs another). Collapsed via union-find into **one canonical node**.
  Signal: equal skeleton **and** equal dynamic-normalized text, **or** equal skeleton **and**
  near-identical pHash (≤ 6 bits). This is where "list with N rows" stops being N screens.
- **CLUSTER** — canonical nodes that are *the same logical screen in a genuinely different
  state* (home empty vs. funded, trade vs. trade-at-max). Kept as **distinct** nodes but
  grouped into a **family**. Signal: **skeleton equality only** — a true equivalence relation.
  (An earlier pHash-band cluster rule was non-transitive and chained far-apart screens into
  one giant family; it was removed. Cross-skeleton state variants are grouped explicitly via
  `overrides.stateGroup` instead.)

The richer node (most elements, then most texts, then lexically-smallest id) wins as the
representative — deterministically.

### 2. classify — states & toggles (`classify.ts`)

For each family, every member gets a **state label** — `default` / `empty` / `loading` /
`error` / `max` — read from its texts by narrow, generic regexes (these are UI-state words,
not app vocabulary). Then it detects **in-place toggles**: members joined to the family
default by a *chain* of `in-place` edges are the same screen in a different
data/condition. They fold into the default's **`stateGroup`** and render as an on-step state
switcher rather than separate navigation steps. (The chain matters: a carousel's slide 3
connects through slide 2, never directly to the default.)

### 3. segment — the flow tree (`segment.ts`)

Flows (a.k.a. *journeys*) are built by walking forward from each entry point:

- A screen with a single forward step **extends the current trunk**.
- A screen that **branches** (≥ 2 forward steps) ends the current flow; each branch becomes a
  **child flow** starting from that screen. So a journey nests under whatever launched it —
  "Send" under "Home", "Privacy" under "Settings".
- **Completion hubs** (home/launch screens) and **main-nav roots** (`graph.mainNav`) break the
  nest-under-launcher rule and root their *own* top-level subtree. Reaching a hub *completes* a
  journey (onboarding → funded home).
- **Pickers / modals** flow through as side-screens (browsable in the Screens tab) rather than
  spawning their own flow.

The result is a tree of journeys, each with an ordered list of step nodes.

### 4. naming (`naming.ts`)

Each flow gets a **mechanical** name derived from its goal screen's title (trailing
parentheticals like "(Owned)" stripped — those describe the screen, not the intent).
Mechanical names land in **`namingTODO`** so the capture agent (or a human) can supply a real
name, which persists in `overrides.flowNames` keyed by the stable flow id.

### 5. replay (`replay.ts`)

For each flow, the trunk's edge selectors are compiled into an inline **`.ad` command
script** (`open <bundleId>`, then `click <selector>` per step) with a confidence rating from
the selector quality (`id=` > `label=`/`role=` > positional). This is what lets a flow be
*re-run* on a device, not just viewed.

### The result: `view.json`

```jsonc
{
  "app": {...}, "captureDate": "...",
  "screens": [ /* one per canonical node, with state/stateGroup + which flows it appears in */ ],
  "flows":   [ /* the journey tree: slug, name, parent, ordered steps, replay */ ],
  "decisionPoints": [ ... ],
  "stats": { "screens": N, "rawNodes": M, "flows": F, "topLevelFlows": T, "replayCoverage": 87 },
  "namingTODO": [ ... ]
}
```

`view.json` is a **build artifact** — never hand-edited. To change anything in it, edit the
graph's `overrides` and re-run the packager.

---

## Overrides: the one hand-edited surface

The graph's observation (nodes/edges/decisionPoints) is written by the capture walk and never
touched by hand. The **only** hand-editable block is `overrides`, written by the edit agent
(or a person) and **carried forward verbatim across re-captures**. Each key corrects exactly
one thing the packager derived:

| Key | Shape | Corrects |
|---|---|---|
| `flowNames` | flow-id → name | the name of a derived flow |
| `structure` | flow-id → `{ parent? }` | re-parent a flow in the tree (`parent: null` pins it top-level) |
| `screens` | node-id → `{ role?, title?, description?, state?, stateGroup? }` | a screen's facts, incl. forcing its state / group |
| `merges` | `string[][]` | force-merge nodes the SAF kept separate |
| `splits` | `string[]` | force-keep nodes distinct that the SAF would merge |

After editing overrides, re-run `pnpm build-data` (or `node scripts/package.ts <graph.json>`).
Because everything is derived, an override is a small, reviewable correction — not a rewrite
of the output.

---

## The build pipeline

```
                    ┌─────────────────────── capture (agent, on a device) ───────────────────────┐
  device walk  ───▶ _staging/walk.json ──assemble.ts──▶ {date}/graph.json   (committed source)
                    └────────────────────────────────────────────────────────────────────────────┘
                                                            │
  pnpm build  ──▶  build-data.ts:  for each graph.json → packageGraph → {date}/view.json
                                   then emit the registry  captures/index.json
                          │
                          ▼
                   next build  (output: "export")  ──▶  out/   (static HTML for every slug/date)
                          │
                          ▼
                   prune-export.ts  ──▶  strip _staging/, secrets, and anything that isn't
                                         JSON/PNG from out/captures  (allowlist; leak-proof)
```

Key properties:

- **`graph.json` is the only committed source per capture.** `view.json` and `index.json` are
  generated by `build-data` and could be gitignored.
- **Routes are data, not fetches.** Every page is prerendered to static HTML at build time from
  JSON on disk — the browse grid from `index.json`, and each `/apps/<slug>` /
  `/apps/<slug>/<date>` page from its own `view.json` (`dynamicParams = false`, so the set of
  pages is fixed and anything else 404s). There are **no runtime data fetches** — the site is
  plain static files.
- **`prune-export.ts` is an allowlist**, not a denylist: after `next build` copies all of
  `public/` into `out/`, it removes everything under `out/captures` that isn't a published
  `*.json`/`*.png`, and drops `_staging/` wholesale — so staging shots, `credentials.md`, and
  any stray secret can't ship.

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
edit      → write overrides into graph.json, re-run package — never hand-edit derived data
```

The agent authors **exactly one** file — `walk.json` — and supplies flow names; it never
hand-computes a hash, builds a flow, or classifies a state. The contract for what goes in
`walk.json`/`graph.json`/`app.json` lives in
[`.claude/skills/app-capture/references/schema.md`](.claude/skills/app-capture/references/schema.md);
`lib/packager/types.ts` is the engine's own copy of those types.

---

## Conventions & gotchas

- **Determinism is the contract.** `packageGraph` must be a pure function of the graph — no
  clock, no randomness, no input-order dependence. Several past bugs (non-transitive
  clustering, input-order-dependent default selection) were exactly violations of this; the
  fixes are documented inline in `saf.ts` / `classify.ts`. If you touch the packager, the
  invariant to preserve is: *reordering the nodes/edges array must not change the view.*
- **`lib/packager/` is types-only at the boundary.** `types.ts` is pure types (erased at
  compile time) so client components can import it; all runtime logic lives in the sibling
  modules, which import `node:crypto` and run only at build time / in the CLI.
- **The engine is intentionally prettier-off.** `lib/packager/` and `scripts/` use a dense,
  hand-formatted style (see `.prettierignore`) — don't run `prettier --write` over them.
- **`skeletonHash` is capture-time and load-bearing.** It's computed once at assemble time and
  drives merge, cluster, *and* the `in-place` edge derivation. It is not recomputed by the
  packager and there's no edge-kind override — to force two same-skeleton nodes apart, use
  `overrides.splits`.
- **Regenerate, don't edit.** After any packager or graph change, run `pnpm build-data` and
  re-run `pnpm test`. The packager tests in `tests/packaging/` pin the tricky invariants
  (toggle chains, cluster equivalence, override survival across merges, cycle-proof hub
  reachability).
- **Captures are isolated.** Each capture is a standalone observation; the capture agent must
  never read another app's files or this app's own prior captures as a reference (only a
  re-capture reads this app's latest graph, to carry `overrides` forward). This keeps one
  app's structure/quirks from leaking into another's graph.
</content>
</invoke>
