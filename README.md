# Wallets Gallery

Wallets Gallery publishes captured UI screens and semantic user flows from mobile wallet and
fintech apps. Each dated capture has two committed sources: `graph.json` records observed app
facts, and `flows.json` records how readers should understand those screens. A pure builder
combines them into the generated `view.json` consumed by the Next.js gallery.

```mermaid
flowchart LR
  device["device walk"] --> walk["walk.json<br/>raw observation"]
  walk -->|assemble| graph["graph.json<br/>observed graph"]
  graph -->|inventory| inventory["post-SAF inventory"]
  inventory --> author["semantic packaging agent"]
  author --> flows["flows.json<br/>authored semantics"]
  graph --> builder["deterministic builder"]
  flows --> builder
  builder --> view["view.json<br/>UI read model"]
  view --> gallery["Next.js gallery"]
```

This README describes the architecture. Working conventions, release rules, and the
determinism contract live in [CLAUDE.md](CLAUDE.md). The full capture schema and agent
workflow live under [.claude/skills/app-capture](.claude/skills/app-capture/SKILL.md).

## Quick start

The repository uses pnpm and Node's native TypeScript support.

```bash
pnpm install
pnpm dev
pnpm build-data
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

`build-data` validates and rebuilds every dated capture. `build` runs that data build before
the Next.js production build.

Semantic packaging tools are available separately:

```bash
pnpm flows:inventory public/captures/<app>/<date>/graph.json
pnpm flows:validate public/captures/<app>/<date>/graph.json
pnpm flows:validate public/captures/<app>/<date>/graph.json --strict
pnpm flows:audit
pnpm flows:migrate             # report deterministic reference patches
pnpm flows:migrate --write     # apply those mechanical patches
```

## Repository layout

```text
app/                              Next.js App Router pages, modal routes, and OG images
components/                       gallery, sidebar, screen, and flow viewers
lib/
  packager/
    types.ts                      graph, flows, inventory, and view contracts
    saf.ts                        canonical screen merge/family projection
    classify.ts                   lifecycle/data derivation groups and labels
    project.ts                    deterministic post-SAF graph inventory
    flows.ts                      semantic validation, audit, and migration
    replay.ts                     best-effort direct forward/picker replay
    index.ts                      packageGraph(graph, flows) → View
    identity.ts                   fingerprint, skeleton, and perceptual-hash helpers
    validate.ts                   observed graph validation
  captures.ts                     server-only generated-view reads
  client-view.ts                  lean RSC-to-client projections
  links.ts / states.ts            dated routes and derivation switcher helpers
scripts/
  assemble.ts                     walk.json → graph.json
  package.ts                      strict graph + flows package inspection
  flows.ts                        inventory/validate/audit/migrate CLI
  build-data.ts                   all-capture view and registry generation
public/captures/
  index.json                      generated app registry
  <app>/app.json                  app metadata and dated capture index
  <app>/assets/                   content-addressed screenshots
  <app>/<date>/graph.json         committed observation source
  <app>/<date>/flows.json         committed semantic source
  <app>/<date>/view.json          generated presentation artifact
```

## The three-artifact model

### `graph.json`: observed app facts

The graph stores screen observations, transitions, decision points, the launch root, and
optional main-navigation destinations.

```jsonc
{
  "meta": { "schemaVersion": 2, "captureDate": "2026-06-23", "app": {} },
  "root": "welcome",
  "mainNav": ["home", "card", "markets"],
  "nodes": [],
  "edges": [],
  "decisionPoints": [],
  "overrides": {
    "screens": {},
    "merges": [],
    "splits": [],
  },
}
```

Each raw node carries three computed identity signals:

- `fingerprint`: exact interactive-control identity, also used for replay entry checks;
- `skeletonHash`: label-free structure used to recognize logical families and in-place
  changes; and
- `pHash`: a visual backstop for exact screen-state merging.

`overrides` corrects observed screen facts only: screen role/title/description/derivation
metadata, forced exact merges, and forced splits. Flow grouping, naming, and hierarchy are
not graph observations and therefore do not live there.

### `flows.json`: authored semantic packaging

The semantic source gives each intent a stable id, name, canonical parent, sibling order,
ordered local screens, and optional screen-level alternate entries.

```jsonc
{
  "schemaVersion": 1,
  "flows": [
    {
      "id": "home",
      "name": "Home",
      "parentId": null,
      "order": 0,
      "steps": ["home"],
    },
    {
      "id": "adding-money",
      "name": "Adding money",
      "parentId": "home",
      "order": 1,
      "steps": ["add-money-source"],
      "entryPoints": [
        {
          "flowId": "earn",
          "fromScreenId": "earn",
          "toScreenId": "add-money-source",
        },
      ],
    },
  ],
  "uncovered": {},
  "flowTODO": [],
}
```

Top-level flows are usable app sections, not folders. Children describe independently useful
intents. A one-screen flow is retained only when it stands on its own. If a one-screen parent
has one child containing its sole continuation, the child is merged into the parent while the
parent's id and name are preserved. Method children are useful when a chooser exposes multiple
peers. Alternate origins are exact screen-level metadata rather than duplicate tree nodes.
Direct graph adjacency and replay availability do not decide semantic membership or parentage.

`uncovered` records a reason for any screen group intentionally omitted from the reader-facing
flows. `flowTODO` supports drafting but is empty in every committed capture.

### `view.json`: generated presentation

The view contains canonical screens, derivation switchers, the semantic flow tree, rendered
steps, optional context tiles, stable id-based slugs, alternate-entry metadata, reverse
`appearsIn` references, decision links, coverage counts, replay status, and diagnostics.

It is generated from the two sources and read by the gallery; semantic edits are made in
`flows.json`, while screen-identity corrections are made in `graph.json.overrides`.

## Deterministic packaging

The builder performs mechanical work only:

1. SAF collapses exact screen observations and establishes canonical ids.
2. Classification builds screen derivation groups from structural signals and explicit
   screen overrides.
3. Flow validation canonicalizes screen references and validates ids, parent/entry references,
   acyclicity, local steps, derivation membership, TODOs, and complete coverage.
4. Authored flows are ordered by `parentId`, `order`, and id. Every local step renders even
   when no transition connects it to the next.
5. A child flow may receive one unambiguous immediate predecessor group from its parent as a
   context tile. The generated step retains only the concrete group members with a recorded edge
   into that child, so variation-specific capabilities remain exact. Split-pinned in-place
   navigation can provide context; same-group state changes cannot. Context never counts as
   semantic coverage.
6. Direct forward and open/return picker patterns compile to optional replay commands. A replay
   is available only when its non-empty command list includes every click on the authored path;
   missing routes or selectors produce diagnostics rather than semantic changes.
7. `appearsIn`, decision links, disposition counts, and diagnostics are derived. A decision
   target links only when exactly one flow contains its logical screen.

For fixed source files, output is byte-stable. Graph node/edge array order and `flows.json`
flow-array order do not change the generated view.

## Screen derivations

The existing screen switcher covers more than lifecycle state. Data instances, available/
pending/active lifecycle states, default/empty/error states, and carousel positions are all
derivations of one logical screen when their interaction and outcome remain the same.

A flow authors one concrete primary member. Authored steps expose the other members in
deterministic state/label/id order, so valid alternatives such as email/phone login remain one
switchable step. A derived context step instead carries `variationIds` and exposes only the
concrete members with a recorded transition into that child flow—for example, RedotPay card
limits is Active-only and Avici adding a card is Issued-only. All members still share semantic
coverage and the same `appearsIn` occurrences; they do not add steps, flows, routes, or replay
actions. Every member has a non-empty name that remains unique after URL normalization. Exact
links retain the step and use the lowercase name, for example `?step=1&variation=issued`. The
variation applies only to the addressed step, even when another step has a variation with the
same name.

## Validation, audit, and migration

The draft validator prints all findings and exits non-zero on hard errors. `--strict` additionally
escalates non-empty `flowTODO` items; `package.ts` and `build-data` always use strict validation.
Validation rejects missing sources, invalid flow ids or references, parent cycles, empty flows,
duplicate derivation members, unaccounted screens, and retired graph semantic overrides. It warns
when a declared main-navigation section has no authored journey. A parent with only one child
produces an authoring advisory to merge the child's steps into the parent, preserving the parent
identity, unless both are independently useful.

Naming validation is separate from semantic grouping. It rejects whole machine-style camelCase
tokens and missing or URL-colliding variation names while allowing brand casing such as `PayPal`,
`RedotPay`, and `iOS`; it does not create, split, merge, or reparent flows.

`flows:audit` aggregates every committed graph/flow pair, including canonical reference
changes, derivation validation, coverage, and cross-capture id-revival advisories.
`flows:migrate` only canonicalizes screen references and collapses consecutive exact duplicates.
It preserves unrecognized top-level fields and combines disposition reasons when multiple raw
screen ids canonicalize to one id. It never creates, groups, names, reparents, or removes a flow.

## Gallery and routes

Every capture is canonical at a dated route:

```text
/apps/<app>/<date>                         screens tab
/apps/<app>/<date>/flows                   flows tab
/apps/<app>/<date>/screen/<screen-id>      screen page/modal
/apps/<app>/<date>/flow/<flow-id>          flow page/modal
```

The bare `/apps/<app>` route is a prebuilt redirect to the latest date. Screen and flow clicks
use App Router intercepting routes for lightbox modals while retaining standalone shareable
pages. Flow ids are URL slugs verbatim, so renaming a flow does not move its URL.

The flow sidebar renders the authored hierarchy. The main flow list remains a flat depth-first
presentation with an inline parent reference. Authored screen variations use the existing
switcher; context variations are filtered by their recorded transition. Alternate entries render
only on their exact source and destination screens and switch flows in the same viewer at the
corresponding step.

## Capture workflow

The capture agent records raw observation into `_staging/walk.json`. `assemble.ts` computes
identity signals, content-addresses screenshots and snapshots, finalizes edge kinds, validates,
and writes `graph.json`. The inventory command then exposes canonical screens and derivation
groups for semantic authoring. The agent writes and validates `flows.json`, and the strict
package command builds the reader-facing view.

```bash
node scripts/assemble.ts \
  public/captures/<app>/_staging/walk.json \
  public/captures/<app>/<date>/graph.json

node scripts/flows.ts inventory public/captures/<app>/<date>/graph.json
node scripts/flows.ts validate public/captures/<app>/<date>/graph.json --strict
node scripts/package.ts public/captures/<app>/<date>/graph.json
pnpm build-data
```

Grouping guidance is in
[flow-grouping.md](.claude/skills/app-capture/references/flow-grouping.md), and the authoritative
screen/derivation/flow/id naming rules are in
[naming.md](.claude/skills/app-capture/references/naming.md).

Temporal observation retention, provenance, retirement, re-binding, and adaptive replay path
finding are not part of this packaging version. They remain a separate follow-up informed by a
real re-capture pilot.
