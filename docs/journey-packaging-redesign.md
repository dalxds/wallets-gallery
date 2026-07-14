# Flow packaging redesign

Status: agreed semantic-packaging plan, ready for implementation. No implementation has
started. Temporal re-capture/retention is a separate follow-up.

This supersedes the earlier "journeys + routes" draft. The semantic entity is called a
**flow** — matching the codebase (`ViewFlow`, `/flow/[slug]`, the Flows tab) — and there is no
flow-level route/variant model: method differences are separate flows, and the only
cross-flow variation is the **entry point**. Screen-level derivations remain: the same
logical screen shown with different data or lifecycle state uses the existing switcher inside
one flow step.

## Summary

Replace the current structural flow segmentation with an agent-authored semantic flow
package. Keep `graph.json` as the observed app graph, add a committed `flows.json` as the
semantic source, and generate `view.json` deterministically from both.

The flow tree remains the primary presentation model:

- Top-level flows represent the app's principal sections and use the app's noun labels, such
  as `Home`, `Cards`, `Markets`, or `Earn`.
- Child flows represent user intent and use action-oriented names, such as `Adding money`,
  `Changing password`, or `Reviewing a transaction`.
- A top-level flow is still a usable flow with its own screens. It is not a folder or a
  separate `Area` type.
- One intent appears **once** in the tree. Alternate entry points are metadata on the flow,
  never duplicate tree nodes.
- A flow has one ordered presentation sequence. The packager does not add phases or split a
  flow because it is long, and the graph need not contain a direct edge between every pair.
- Parallel derivations of one logical step are switcher content, never sequential tour steps
  or separate flows.

## Why change

The current packager derives the published flow tree from navigation dominance and branch
shape. That makes it deterministic, but it frequently packages navigation fragments instead
of human journeys. Across the current captures, most flows contain only a shared launcher and
one new screen, and shared intents are duplicated under several navigation roots (one intent
becomes `adding-money` and `adding-money-2` with distinct URLs).

The redesigned system separates three concerns:

1. `graph.json` records what the app contains and how screens connect.
2. `flows.json` records how a reader should understand those screens as user flows.
3. `view.json` contains the validated, denormalized presentation plus any replay that can be
   derived without changing the semantic package.

## Alternatives considered

A deterministic redesign of `segment.ts` was explored first (goal-anchored flows, dead-end
side surfaces woven without return edges, prefix merging, "tours" grouping leftover
single-screen surfaces). It raises the floor but not the ceiling: structure cannot recover
_intent_ — the same intent often ends on different screens, different intents share generic
success screens, and canonical ownership ("Adding money belongs under Home") is a semantic
judgment by definition. This plan accepts the maintenance cost of an authored file in
exchange for human-curated tree quality.

The captureTODO/"deepen" frontier loop from that exploration is **deferred** as a separate
initiative, not dropped. Tours are **dropped** as an ontology: an independently useful
single-screen destination may be its own flow; a transient surface may remain a step in the
coherent intent it supports; chrome and capture noise may be intentionally uncovered. Sibling
destinations are never bundled merely to make a longer row.

## Goals

1. Organize screens around user intent while preserving the app's recognizable top-level
   sections.
2. Keep one canonical tree node for one intent, even when the intent is reachable from
   several sections.
3. Preserve relative composition: when a recorded route is available, a child flow may show
   its single immediate predecessor as context (as today), never a repeated deep ancestor
   chain. Replay availability never determines grouping or validity.
4. Produce byte-stable generated output from committed source files.
5. Keep the semantic packaging process reviewable and editable.
6. Give flow naming and screen naming separate, explicit guidelines.
7. Present data-instance and lifecycle derivations together without pretending they are a
   sequential journey.

## Non-goals

- Inferring semantic grouping during the static build.
- Adding a separate area, folder, phase, or flow-level route-variant model. Screen derivations
  use the existing state-group/switcher mechanism, not routes.
- Requiring every captured screen to become its own flow.
- Fabricating transitions that are not present in the graph.
- Making semantic parentage, flow membership, or build success depend on replayability.
- Building an adaptive live-state graph pathfinder in v1. Replay-path resolution beyond the
  current direct recorded patterns is a separate iteration.
- Implementing temporal graph overlay, retained observations, re-capture policy, or
  proven-absence retirement in the semantic-packaging release.
- Using an LLM or agent during `pnpm build`.
- Backwards compatibility: the app is new, so existing flow URLs break with no redirects or
  aliases, and no legacy code path is kept.

## Proposed data flow

```mermaid
flowchart LR
  walk["walk.json<br/>raw walk"] -->|assemble| graph["graph.json<br/>observed graph"]
  graph -->|"inventory emit<br/>(deterministic)"| inv["inventory<br/>post-SAF projection"]
  inv --> agent["semantic packaging agent"]
  guides["flow-grouping.md<br/>naming.md"] --> agent
  agent --> flows["flows.json<br/>semantic source"]
  graph --> builder["deterministic view builder"]
  flows --> builder
  builder --> view["view.json<br/>UI-ready artifact"]
  view --> gallery["gallery"]
```

`graph.json` does not contain or perform semantic grouping. The packaging agent reads the
inventory (plus snapshots/screenshots as needed) and writes `flows.json`. The view builder
makes no grouping or naming decisions. There is **no structural candidates stage**: the
dominator-tree segmenter is deleted, not repurposed — the agent groups directly from the
observed graph.

## Flow model

There is one semantic entity, `Flow`. Top-level and child flows use the same shape.

```ts
interface FlowsFile {
  schemaVersion: 1
  flows: FlowDefinition[]
  /** canonical screen id → reason it is intentionally not part of any flow */
  uncovered: Record<string, string>
  /** unresolved grouping/placement/naming questions — never guessed silently.
   *  MUST be empty in a committed capture; it exists for the authoring loop. */
  flowTODO: { about: string; question: string }[]
}

interface FlowDefinition {
  /** Stable identifier for this intent AND the public URL slug. Kebab-case and
   *  human-readable: renaming the flow never changes it. Unique within the capture. */
  id: string
  name: string
  /** Optional one-line description; rendered by the existing UI (`ViewFlow.summary`). */
  summary?: string
  /** Canonical semantic placement in the tree. null for top-level flows. */
  parentId: string | null
  /** Sibling order under parentId. Collisions tie-break by id. */
  order: number
  /** LOCAL presentation steps, in the order that best explains the intent — one concrete
   *  primary member per logical screen. Every entry is rendered. Direct graph adjacency and
   *  replayability are not required. At least one entry: every flow is usable, never a folder. */
  steps: string[]
  /** Other flows that visibly expose this intent. Metadata only — never tree nodes. */
  entryPoints?: string[]
}
```

There is **no supporting-interaction tier**. Every useful screen selected to explain an intent
is an authored step; login, KYC, registration, onboarding, pending lifecycle states, sheets,
and confirmations are not removed because they are hard to replay. Other members of the same
logical screen are derivations exposed at that step. A screen that is genuinely not useful to
readers goes to `uncovered`.

A replay route may pass through screens associated with other semantic flows. Those connector
screens remain visible in those flows but are not duplicated into the target flow merely
because replay traverses them.

A canonical screen or derivation group may be a local step in more than one flow when it
genuinely contributes to different intents. This creates multiple occurrences, not multiple
owners: `appearsIn` lists them all. When the repeated routes describe the same intent, use one
flow plus `entryPoints` instead.

### Semantic steps and optional replay

A flow's `steps` are only the screens it adds to the presentation. The parent chain gives the
flow semantic context; it is not concatenated into a required navigation route.

```text
home                 parent: null               steps: [home]
managing-account     parent: home               steps: [profile]
managing-security    parent: managing-account   steps: [security]
changing-password    parent: managing-security  steps: [change-password]
```

`changing-password` therefore reads as `Home → Managing account → Managing security → Changing
password`, while its row contains the locally authored `change-password` screen. If the graph
has an unambiguous recorded predecessor, the UI may prepend that single screen as a context
tile. Missing context or replay is a diagnostic, never a semantic error.

In v1, replay remains a separate, best-effort derivation. The existing compiler may emit a
replay when the authored screens match its direct recorded forward/picker patterns. Otherwise
`view.json` records replay as unavailable and still publishes the complete flow. A later
replay iteration may resolve connector paths from the currently matched live screen; those
paths will remain operational metadata, not semantic flow content.

The v1 replay begins at the first authored screen or an unambiguous immediate predecessor and
keeps today's `entryFingerprint` verification. It does not navigate from app launch to that
entry; live-state entry resolution belongs to the later pathfinder iteration.

### Parent placement

A flow has exactly one parent, chosen by the packaging agent with this priority:

1. The section that most prominently presents the intent.
2. The section whose core purpose is most closely related to the intent.
3. The app's visible information architecture and terminology.
4. Authored `mainNav` order, then flow id, as deterministic tie-breakers.

`parentId` answers only **where the intent belongs for readers**. Graph reachability never
changes that answer. Capture state must not force card-management intents beneath card
registration merely because the active-card screen was reached during registration.

### Entry points

When a flow is also reachable from other sections, those are listed in `entryPoints`. Tuyo's
example:

```jsonc
{
  "id": "adding-money",
  "name": "Adding money",
  "parentId": "home",
  "order": 1,
  "steps": ["add-money-source", "add-money-amount"],
  "entryPoints": ["earn"],
}
```

`Adding money` appears once, under `Home`. The Earn origin is a chip in the viewer, not a
second tree node, second URL, or count. Entry points do not chain or compose. Each is validated
only as a reference to an existing flow. It records human-visible discoverability, not a
concrete transition, replay start, or alternate route.

### Methods are separate flows

Different _methods_ for one outcome (bank transfer vs. card, crypto vs. fiat deposit) are
**separate flows**, not variants: the difference is real content — different screens,
lengths, and endings — which is exactly what a flow is. The method-chooser screen is a
natural hub: `Adding money` ends at the chooser and the methods are its children. Rule of
thumb: alternate entries share everything but the prefix; if the screens after the entry
differ, it is a different flow.

Screen derivations are narrower: same intent, interaction structure, and outcome, with only
the entity, data, or lifecycle state changing. Gold, MetaDAO, and Wrapped BTC detail screens
are derivations of one `Viewing assets` step; bank transfer and card funding are different
method flows.

### Screen derivations: one logical step, multiple examples

The existing `stateGroup`/screen-switcher mechanism is generalized as a **screen derivation
group**. It covers:

- data instances of one surface (`Gold`, `MetaDAO`, `Wrapped BTC` asset details);
- lifecycle states of one surface (`Cards: available`, `pending`, `active`);
- ordinary UI states (`default`, `empty`, `loading`, `error`); and
- ordered informational/carousel states.

The graph remains the source of this screen-identity fact. SAF supplies same-structure logical
families; `graph.json.overrides.screens[*].stateGroup` can force a family when lifecycle states
have different skeletons, and `state` supplies the switcher label. The inventory exposes the
groups to the packaging agent.

A flow authors **one primary member** of the group in `steps`. The builder preserves that
concrete id for initial display, while `view.json` exposes every group member through the
existing switcher. It does not remap the authored member to the family default. Derivations:

- occupy the same flow step and share its `appearsIn` reference;
- count as covered when that logical step is covered;
- do not create steps, flows, tree nodes, URLs, counts, or sequential replay actions;
- require no transitions between one another; and
- render in a deterministic order from state metadata, then label and screen id.

```text
Markets
  Viewing assets
    Asset detail [Gold | MetaDAO | Wrapped BTC]
  Buying SpaceX
```

This is not a tour: the authored primary asset detail opens first, while the other captured
derivations are inspectable in the same step. A screen with materially different interaction
or outcome is split from the group. SpaceX remains part of `Buying SpaceX` because it
continues into amount and review screens.

Screen groups may help optional replay select a recorded concrete state. For example,
`card-active → card-limits` can supply a replay predecessor or context tile for `Setting card
limits`. It never determines that the flow belongs under `Cards`; that is already settled by
the semantic parent.

### Detours and transient screens

Detour screens — sheets, pickers, leaf pages that pop back to where they were opened — are
ordinary entries in `steps` when they provide useful information or are meaningful parts of
the same intent. Their inclusion and order are semantic, authored decisions. A return edge
does not automatically pull a leaf page into the flow that launches it; the agent first
decides whether it supports that intent or is an independently useful destination.

The v1 replay compiler may internally recognize the existing direct open-and-return picker
pattern and emit the corresponding actions. A missing return edge makes that replay
unavailable; it does not remove the sheet, invalidate the flow, or promote the sheet into a
standalone flow. A future general pathfinder can replace this special-case replay logic.

Derivations are not detours and are never replayed sequentially. In RedotPay card
registration, promo-code and total-expanded application screens are derivations of the card
application step; the Pro-membership modal is a useful transient step in the same registration
flow even when its return cannot currently be replayed.

### Flow validity is semantic, not length-based

**Every flow must have at least one local step. There is no larger minimum.** A parent must be
a usable flow with its own content, never an empty folder, but one local screen can be a
complete flow when the destination itself provides useful information, capabilities, state,
or a coherent set of options.

For example, a Settings screen may own a one-screen child flow whose local step is the
Security settings screen:

```text
Settings                         steps: [settings]
  Managing security settings    steps: [security-settings]
```

The child reads as `Settings → Security settings`; its local screen communicates the available
security controls. If a recorded immediate predecessor is available, the current UI may also
show it as a context tile. If those controls open deeper intents, `Changing password`,
`Configuring biometrics`, or `Setting a transaction PIN` can be child flows beneath it.

The packaging agent applies these distinctions:

- **Independently useful destination** — make it a flow, even when it has one local screen.
- **Transient or necessary screen for the same outcome** — keep it as a step in that flow.
- **Same screen and intent with different entity/data/lifecycle state** — keep one flow step
  and expose the screens as derivations in its switcher.
- **Sibling destinations with different intents** — keep them as separate flows; never weave
  `Privacy`, `Notifications`, `Security`, and `Language` into a tour merely to make a longer
  row.
- **Chrome, capture noise, or a genuinely non-useful surface** — put it in `uncovered` with a
  reason.

This removes today's structural fragment noise through semantic grouping, not through a
minimum length. Missing or incomplete transitions affect only replay and re-capture
diagnostics; they never decide whether the screen belongs in the flow.

### Screen references

`steps` and `uncovered` may reference raw node ids; the builder canonicalizes them through
the SAF merge map and collapses consecutive references that merge to the exact same observed
screen. A reference to a concrete derivation is **preserved**, not remapped to the group's
default: it controls the initial screenshot and the identity of the authored example. Other
derivations remain switcher content, not steps. Deterministic canonicalizations are reported
so the committed source can be cleaned.

### Dispositions and coverage

Every canonical screen or screen derivation group must have exactly one implied disposition:

- **covered** — appears in some flow's local `steps`, or belongs to the derivation group of a
  covered step;
- **uncovered** — listed in `uncovered` with a reason (hub chrome, dead end, capture noise).

Anything else is **unaccounted** and fails the build. A derivation may not be both separately
uncovered and a member of a covered group. Mechanically derived context tiles do not count as
coverage — the screen is covered by the flow where it is semantically local.
`view.json` reports the counts (e.g. `62 screens: 58 covered, 4 uncovered, 0 unaccounted`),
so "the agent forgot a screen" is mechanically visible — the semantic analog of
`uncapturedSections`.

Capture freshness is orthogonal to coverage. A retained, not-recaptured screen remains
covered by its semantic flow; it is never moved to `uncovered` merely because the current app
session cannot reach it.

## Naming

Top-level flows use the app's noun-based section labels (`Home`, `Cards`, `Markets`, `Earn`)
— readers orient by the app's own navigation language. Child flows use an intent phrase,
normally gerund + object:

```text
Home
  Adding money
    Bank transfer
    Card
  Sending money
  Reviewing a transaction
  Managing account settings
    Changing password
    Configuring privacy
```

`naming.md` is the single authoritative reference, with separate sections for:

**Screen names** — stable noun phrase for the visible screen; prefer the app's visible page
title when specific and durable; functional noun phrase otherwise; state qualifier only when
materially distinct; no volatile user/asset/transaction data in the canonical title.
Examples: `Security`, `Token detail`, `Deposit amount`, `Transaction receipt`.

**Derivation labels** — concise visible entity/state labels inside the screen switcher, not
flow names: `Gold`, `MetaDAO`, `Wrapped BTC`; `Available`, `Pending`, `Active`. The shared flow
uses the general intent (`Viewing assets`) and the shared screen uses the stable functional
title (`Asset detail`). Labels and their stable order come from screen-state metadata, not
volatile values such as balances or transaction amounts.

**Flow names** — noun sections at top level; gerund + object for intents (`Managing`,
`Reviewing`, `Browsing`, `Learning about` for broader ones); method children are named by the
method noun (`Bank transfer`, `Card`) since the parent carries the intent; no entry context
in the name (entries are metadata); qualifiers only to distinguish different outcomes;
sibling names concise and grammatically parallel.

**Ids** — authored during grouping but permanent as URLs: kebab-case, human-readable,
name-like (`adding-money`, not `f12` or `add-money-v2`). Uniqueness within a capture is a
hard validator error. The capture date already scopes every canonical URL:
`/apps/[app]/[date]/flow/[id]`, so dates never appear inside the id. The same intent keeps its
id across captures and may reuse it when a removed feature later returns. Reappearance after
an absent capture produces an advisory validator warning for human confirmation, not an
error. Reviewing and committing that package is the acknowledgment; no date suffix, reuse
ledger, or extra schema field is added. A materially different intent uses a new, meaningfully
qualified id rather than taking over a historical one.

**Non-section top levels** — the pre-navigation phase (welcome, onboarding, auth) roots its
own top-level flows. These are intent-named (`Onboarding`, `Signing in`) — the noun rule
applies to `mainNav` sections, not to phases the app's navigation doesn't label. An app with
no `mainNav` gets all its top-level flows this way.

## Packaging-agent workflow

The semantic packaging agent runs after assembly and before the deterministic view build.

**Inputs.** A deterministic **inventory** emitted from the graph (a post-SAF projection: the
canonical screens with id, title, role, texts, primary CTA, logical family/state-group
membership and derivation label; the edges; decision points; `mainNav`), plus the two guideline
references. For visual disambiguation the agent prefers
**UI-tree snapshots** (`*.snap.json` via `snapshotPath` — local-only, present where packaging
runs) over screenshots; the inventory's texts and elements usually suffice, and screenshots
are the fallback when `snapshotPath` is null or pixels genuinely matter. The inventory is
ephemeral (staging, not committed).

**Passes** — grouping is settled before naming:

1. **Inventory.** Read the canonical screens, screen derivation groups, transitions, decision
   points, and top-level navigation.
2. **Audit derivations.** Confirm that same-screen data/lifecycle examples share a logical
   group and that materially different screens do not. When the graph needs a forced
   `stateGroup`/split correction, report it through the screen-override workflow and regenerate
   the inventory before authoring flows.
3. **Group by intent.** One flow per coherent outcome or independently useful destination;
   methods split at their chooser hub; repeated entry contexts become `entryPoints`, never
   duplicates. Screen count is not a grouping criterion: retain meaningful one-screen flows
   and never bundle sibling destinations into a tour. Same-intent derivations occupy one step.
4. **Choose parents.** Apply the semantic placement priority without using graph reachability
   or replayability as a grouping signal.
5. **Define steps.** Author one primary screen per logical step, in experienced order —
   detours included only when they support that intent; derivations excluded because the
   screen group exposes them. Direct transitions are not required. A screen not worth showing
   goes to `uncovered` with a reason; a hard-to-recapture screen does not.
6. **Name.** Apply `naming.md` only after structure is stable; author ids as URLs and verify
   derivation labels describe only the entity/state.
7. **Audit coverage.** Every screen or derivation group covered or `uncovered` with a reason —
   zero unaccounted.
8. **Report uncertainty.** Ambiguous grouping, placement, or naming goes to `flowTODO`; never
   guess silently. Replay gaps are separate diagnostics, not semantic TODOs.

The agent's loop is author → **validate** → build. The standalone validator CLI (the
`flows.json` analog of `validate.ts`; final name at implementation) checks every rule the
builder enforces and reports agent-actionable errors ("flow `adding-money`, step 2: no screen
named `deposit-amount`") without running the full build. **Drafts may carry warnings
and `flowTODO` entries; a committed capture may not contain `flowTODO` entries or blocking
errors**. Advisory diagnostics, including confirmed same-intent id revival, may remain — see
the failure policy below.

## Editable guidelines

Two authoritative references in the capture skill:

```text
.claude/skills/app-capture/references/flow-grouping.md
.claude/skills/app-capture/references/naming.md
```

`flow-grouping.md` defines: grouping by outcome rather than screen location or graph shape;
methods-are-flows and the chooser-hub pattern; the distinction between screen derivations,
transient steps, methods, and separate intents; canonical parent selection; entry points;
semantic flow validity independent of length and replayability; how to distinguish an
independently useful one-screen flow from a transient step; the prohibition on artificial
sibling tours, areas, phases, and length-based splits; when to use `uncovered` and when to
file a `flowTODO`.

`naming.md` carries the naming rules above. The capture agent and the packaging agent read
the same file; the current naming guidance in `exploration.md` and `editing.md` is replaced
by links to it.

## Deterministic view builder

For fixed `graph.json` and `flows.json`, the builder produces byte-identical output. It
performs only mechanical work:

1. Run SAF, state classification, and forced screen-group overrides; establish deterministic
   derivation membership, labels, and ordering.
2. Canonicalize exact screen merges and collapse consecutive exact duplicates while preserving
   the concrete derivation authored in each step.
3. Resolve semantic parent chains and entry references; reject cycles or dangling ids. Graph
   adjacency plays no role.
4. Render every authored local step and its screen derivations in stable semantic order.
5. Select among parallel edges with the existing documented total ordering.
6. Best-effort, run the existing direct forward/picker replay compiler. A derivable route is
   `available`; an underivable route is `unavailable`. When the compiler can derive an
   unambiguous immediate predecessor, prepend that single context tile using today's "Entry
   point" presentation. Otherwise keep the semantic row intact and emit diagnostics.
7. Slugs are the flow ids, verbatim.
8. Derive `appearsIn` over every occurrence of the rendered logical steps and their
   derivations. A decision-point option links automatically only when exactly one flow contains
   its target or target derivation group as a local step. Multiple candidates produce no link
   plus a diagnostic; tree position and lexical order never break the tie. Derive coverage
   counts and diagnostics.
9. Serialize arrays and object keys in a stable order.

**Failure policy.** One rule set, two enforcement points. The **validator CLI** runs it in
draft mode: everything is reported, nothing blocks iteration. The **build** (`pnpm
build-data`) runs it strictly: a committed capture must be fully valid — every authored
parent, entry, and step reference validates; screen derivation groups validate; the parent
graph is acyclic; ids are unique within the capture; every flow contains at least one local
step; every screen is
accounted for; `flowTODO` is empty; `flows.json` is present. Any violation fails the build.
The builder **never silently removes authored data**. Missing transitions, incomplete
selectors, and unavailable replay routes are reported separately and do not fail semantic
validation. The builder never regroups, renames, or re-parents.

## Engine changes and content migrations

`build-data` regenerates every dated capture, so strict validation intentionally makes a SAF,
canonicalization, or state-classification change a content migration when it alters semantic
inputs. The cost grows with capture history; this plan accepts that cost to prevent historical
pages from silently changing or becoming incomplete.

The implementation provides two all-capture commands:

- `flows:audit --all` runs the proposed engine against every committed graph/flow pair,
  aggregates all canonical remaps, derivation-group changes, invalid references, and coverage
  changes, and exits without writing.
- `flows:migrate --all` applies only deterministic reference canonicalization, then writes a
  report and patch candidates. It never groups, names, parents, adds, or removes flows; any
  semantic ambiguity remains a human review item.

An engine change that affects semantic identity must include its audit report and every
required `flows.json`/`view.json` migration in the same PR. The build remains strict after the
migration. If the history becomes too large for all-capture migration, freezing old generated
views or versioning the engine is a later scalability decision; v1 does not retain multiple
packager implementations.

## Role of `view.json`

Unchanged in purpose: the generated UI read model, never hand-edited. It contains the
canonical screens and derivation/state groups; the semantic flow tree; each flow's rendered
steps (an optional mechanically derived context tile plus every local step); semantic entry
points; screenshot paths; replay status (`available | unavailable`) and optional commands;
slugs (= ids); reverse screen-to-flow references; coverage counts and diagnostics. There is no
authored route or launch field. The `stats` block drops `truncatedFlows` (no length cap exists)
and gains disposition and replay-availability counts. Semantic changes go to `flows.json`;
screen-fact corrections stay in `graph.json.overrides.screens`.

## URLs and deep links

- A flow's URL is `/apps/[slug]/[date]/flow/[id]`. The id **is** the slug; renaming a flow
  never changes its URL. Today's name-derived slugs (`slugify(name)`) are replaced —
  **every existing flow URL breaks, deliberately, with no redirects** (see Non-goals).
- `?step=N` keeps today's semantics: a 1-based index into the flow's rendered steps.
- No entry/route URL parameter exists. Share links and OG cards use the canonical flow URL.

## UI behavior

The redesign changes data ownership and the tree's content, not the browsing interaction.

- **Sidebar** (`FlowNode`): unchanged mechanics — noun-named top levels, intent-named
  descendants, recursive as today.
- **Grouped list** (`FlowsView`/`FlowRow`): keeps today's deliberate flat, depth-first
  presentation with the inline "from {parent}" reference. Rows keep today's exact shape —
  an available context tile + the flow's own steps, or only the authored steps when no context
  is derivable. A meaningful one-screen child therefore remains a concise one- or two-tile
  row, while multi-step intents remain longer; presentation never pads or combines flows to
  produce a preferred row length. Revisit the flat list only if deeper semantic trees read
  poorly in practice.
- **Viewer and standalone page** (`FlowViewer`): render the same rendered steps; no deep
  ancestor chain (the tree placement and parent reference carry the origin). One new
  metadata line — "Also reachable from **Earn**" — plain chips linking to the entry flows.
  Screen derivations use the existing switcher; no route selector is added.
- **Screens**: the existing state switcher becomes the general derivation switcher for data
  instances, lifecycle states, ordinary UI states, and carousels. It opens on the concrete
  primary member authored for that step. Every member shares the same `appearsIn` flow/step;
  entry points remain per-flow metadata.
- **Counts**: `flows.length` (tab badge, OG) now counts canonical flows — no duplicate
  inflation.

`flows.json` is committed, ships via the `.vercelignore` `*.json` allowlist, and must never
be excluded there — it is a build-data input.

## Deferred follow-up: temporal re-capture

Temporal retention is deliberately **not part of the semantic-packaging release**. Every app
currently has one dated capture, so shipping provenance, graph overlay, re-capture policy,
coverage proof, retirement, and re-binding against simulations alone would combine two
separable risk areas. The first real re-capture will run as a development pilot and inform a
follow-up design before a second dated capture is published.

The product requirements already agreed for that follow-up are:

- Useful login, onboarding, KYC, registration, and one-time lifecycle screens remain semantic
  flow content even when the current account cannot revisit them.
- An inaccessible screen can retain its last-known content and is classified as **not
  re-captured**, never changed or removed merely because replay cannot reach it.
- Retained screens render normally with a subtle "Last captured {date}" indicator, not a
  warning or changed badge.
- A retained screen retires only explicitly or after a complete re-capture proves it absent
  from every prior containing scope.
- Re-capture mechanics and policy remain outside `flows.json`; replayability and freshness
  never affect semantic grouping.

The pilot must decide the implementation details from real evidence: provenance granularity,
whether `assembleGraph` overlays the prior graph or consumes a pre-merged walk, where
on-demand policy lives, how completed coverage proves absence, and how reference re-binding
handles changed ids. These are follow-up decisions, not provisional v1 schemas or acceptance
criteria.

## Migration plan

### 1. Specify the semantic source

- Finalize the `FlowsFile` schema; build the standalone validator CLI and the inventory emit.
- Specify the screen-derivation contract and semantic/replay boundary; write
  `flow-grouping.md` and `naming.md`.
- Build the all-capture `flows:audit --all` and mechanical `flows:migrate --all` commands
  before changing canonicalization behavior.

### 2. Produce golden semantic packages

- Author reviewed `flows.json` fixtures for Avici, RedotPay, and Tuyo, converting the
  existing `overrides.flowNames` (119 entries) and `structure` blocks as raw input.
- Use the [intent-based dry run](journey-packaging-simulation.md) (28 Avici, 65 RedotPay, and
  26 Tuyo flows) as starting material, not committed truth. It covers every screen/group
  without tours and identifies four RedotPay return edges that currently prevent direct
  replay but do not block packaging.
  Treat the earlier counts (~22, ~55, ~23) as obsolete because they suppressed meaningful
  one-screen flows. The reviewed fixtures are the gate.
- Resolve ambiguous placement and method-vs-entry cases here, before touching the packager.
- **Empirical gates**: a human semantic review that independently useful one-screen
  destinations remain flows, same-intent derivations share one logical step, unrelated sibling
  destinations never form tours, and card-management flows remain under `Card(s)` regardless
  of recorded route shape; plus a visual pass over the rendered rows and derivation switchers.

### 3. Build the semantic packaging agent

- Inventory + snapshot-first inputs; the ordered passes above; validator-driven loop;
  complete coverage and explicit `flowTODO` output.

### 4. Replace the packager

- Keep SAF, screen derivation/state classification, deterministic edge selection, selector
  confidence, replay command emission, and stable serialization.
- Validate `flows.json` semantically and run direct replay derivation as an optional second
  pass. Missing replay never removes steps or fails `build-data`.
- Delete `segment.ts` entirely (dominator tree, excursion _detection_, cross-section
  re-emission, `MAX_TRUNK`) and the mechanical-naming machinery (`nameKeyOf`, `namingTODO`,
  name-derived slugs).

### 5. Adapt the gallery

- Id-based slugs; entry chips; generalized labels for the existing derivation/state switcher;
  optional context tiles; replay status; updated counts.

### 6. Migrate capture and editing workflows

- Capture skill runs semantic packaging after assembly.
- Delete `flowNames` and `structure` from the `Overrides` type; the graph validator rejects
  them. Screen identity/derivation corrections stay in `overrides.screens`.
- Document temporal retention as unsupported by this release; run the first real re-capture as
  a follow-up pilot before publishing another dated capture.

### 7. Cleanup scope

Removing the superseded machinery is an acceptance condition, not optional follow-up work.
The implementation must leave no compatibility path that can derive, rename, or repair a flow
semantically during the static build.

- **Segmentation**: delete `segment.ts` and all callers, types, fixtures, and comments for the
  dominator tree; virtual super-source and anchor discovery; hub/trunk construction;
  excursion discovery; homogeneous detail fan-out; cross-section re-emission; structural
  duplicate flows; single-screen-flow dropping; `MAX_TRUNK` splitting; and
  `overrides.structure` application/cycle repair.
- **Package orchestration**: remove `index.ts` logic that derives nav roots, decision-point
  sibling order for segmentation, structural journeys, automatic excursion ownership,
  duplicate-flow suffixes, and generated parent relationships. Decision points remain only
  as observed graph facts used to derive unambiguous viewer links.
- **Flow naming and URLs**: remove `nameKeyOf`, `FlowName`, `journeyName`, `cleanFlowName`,
  flow-name fallback generation, `slugify`, collision suffixing, `namingTODO`, `nameSource`,
  and all `overrides.flowNames` canonicalization. Keep or relocate only deterministic screen
  title helpers (`screenTitle`/`humanize`); flow names and ids come verbatim from `flows.json`.
- **Schema and types**: remove `Overrides.flowNames`, `Overrides.structure`, `NameSource`, the
  old raw-node meaning of `ViewFlow.entryPoints`, `View.namingTODO`,
  `View.stats.truncatedFlows`, and `View.uncapturedSections`. Add the `FlowsFile` types,
  semantic string entry points, optional context/replay diagnostics, coverage/disposition
  diagnostics, and the id-based slug contract. The graph validator rejects the retired
  override keys.
- **Replay integration**: remove the old `Journey`/`SegmentResult` and excursion-plan inputs to
  replay. Retain the replay command builder, selector-confidence rules, and deterministic edge
  selection as a best-effort pass over authored semantic steps. Direct forward/picker patterns
  may emit replay; anything else emits an unavailable diagnostic without changing the flow.
- **CLI and build output**: replace the one-input `packageGraph(graph)` and
  `scripts/package.ts <graph.json>` naming loop with graph + flows validation/build commands.
  Remove `namingTODO` printing and replace it with flow-schema, reference, coverage,
  `flowTODO`, and non-blocking replay diagnostics. Add the all-capture audit/migration commands;
  `build-data` has no graph-only fallback.
- **Capture data**: after each app has a reviewed `flows.json`, delete `flowNames` and
  `structure` from its `graph.json`; regenerate `view.json` so no retired fields or duplicate
  name-derived slugs remain. Preserve observation corrections in `overrides.screens`,
  `merges`, and `splits`.
- **Gallery**: remove reads of `nameSource`, `namingTODO`, `truncatedFlows`, raw-node entry
  points, and name-derived slug assumptions. Support optional context/replay. Do not add
  adapters or redirects for the old representation.
- **Docs, same change**: rewrite the README packager section; update `schema.md` for the
  reduced graph overrides and the new `flows.json` contract; replace naming instructions in
  the capture `SKILL.md`, `editing.md`, and `exploration.md` with links to the single
  `naming.md`; update `temporal.md` to stop describing flows as derived and mark retention as a
  deferred follow-up; remove the `namingTODO` loop; and update CLAUDE.md for the hand-authored
  semantic and observation-correction surfaces.
- **Tests**: delete expectations for dominator segmentation, structural duplicate flows,
  automatic excursion ownership, detail-fan collapsing, one-screen-flow removal,
  `MAX_TRUNK`, structure overrides, mechanical flow names, name-derived slugs, and
  `namingTODO`. Rewrite `tests/packaging/` around authored semantic fixtures. Extend the
  determinism invariant to the second input: reordering semantically unordered arrays in
  `flows.json` must not change `view.json`. Add named fixtures for one-screen flows, deep
  parent resolution, alternate entries, primary plus data derivations, lifecycle derivations,
  semantic parents without graph junctions, optional context, direct replay success, replay
  unavailability without semantic failure, repeated screen occurrences, ambiguous
  decision-point targets, all-capture audit aggregation, and mechanical engine migration.
- **Retained deterministic core**: keep graph validation, identity helpers, SAF screen
  canonicalization, state/state-group classification, adjacency and edge canonicalization,
  deterministic parallel-edge selection, screen projection, replay command emission, and
  stable serialization. These operate on observed screen facts or validate authored flows;
  none chooses semantic grouping, ownership, naming, or flow length.
- **Release**: make the semantic cleanup and replacement one MAJOR-version change with a
  CHANGELOG entry; do not ship an intermediate release containing both semantic sources.
  Temporal retention ships later and does not preserve or restore the old semantic source.

## Validation and acceptance criteria

- Identical source files generate byte-identical `view.json` output; reordering
  `graph.json` node/edge arrays or semantically-unordered `flows.json` arrays changes
  nothing.
- Every flow has a stable kebab-case id, a valid name, an explicit parent, and at least one
  local step; ids are unique within the capture. A returning flow keeps its id when its intent
  is unchanged; revival after an absent capture emits an advisory review warning, while a
  materially different intent must use a different id.
- The parent graph is acyclic; parents and entry points reference existing flows. Neither
  requires a recorded transition or replay route.
- No flow exists solely to satisfy graph structure; semantic tree placement and replay remain
  separate concerns.
- A committed `flows.json` has an empty `flowTODO` and no unresolved blocking validator
  findings; the builder never silently drops authored data.
- Every canonical screen is covered directly, covered through a screen derivation group, or
  uncovered-with-reason; unaccounted is zero.
- Alternate entry points never create tree nodes, URLs, or count inflation.
- Top-level names use app section labels; child names follow the intent guide; method
  children are method-named; no flow is split by length.
- Flow length is not a validity criterion: meaningful one-screen destinations remain flows,
  and sibling intents are never bundled merely to increase row length.
- Every authored member in `steps` is rendered even when replay is unavailable. Non-primary
  derivations occupy the same logical step and remain switcher examples rather than
  sequential replay actions.
- A canonical screen may occur in multiple flows when it supports different intents, and
  `appearsIn` preserves every occurrence. When the occurrences express the same intent, the
  package uses one flow plus `entryPoints` instead.
- A decision-point option links to a flow only when exactly one local-step occurrence matches
  its target. Multiple candidate flows produce no link and a diagnostic; parentage, order, and
  lexical tie-breakers never choose an owner.
- Golden fixtures for Avici, RedotPay, and Tuyo match their reviewed semantic packages,
  including a human visual pass over the rendered rows.
- `flows:audit --all` validates every committed capture and aggregates identity, derivation,
  reference, and coverage impacts. `flows:migrate --all` produces byte-stable mechanical
  reference migrations without making semantic grouping decisions.
- Any engine change that alters canonical identity or derivation membership includes the
  audit result and all required capture migrations in the same change; every committed
  capture then passes strict `build-data` validation.
- Screen derivation switching, sharing, replay, and static generation continue to work.

## Decisions captured by this plan

- The semantic entity is a **flow** (not "journey"); the semantic source is `flows.json`,
  one per dated capture, beside `graph.json`.
- Top-level flows use noun section names; child flows use intent names; pre-nav phases are
  intent-named top levels.
- Methods are separate flows split at their chooser hub; there is no flow-level route/variant
  model. Same-screen data, lifecycle, and UI examples remain screen derivations of one logical
  step and use the existing switcher.
- A flow's parent is its canonical semantic placement. `launchFromScreenId` does not exist;
  graph reachability never determines parentage. Alternate entries are semantic metadata
  chips — no duplicate flows or route selector.
- Authored steps are the screens that explain the intent. Useful login, onboarding, KYC,
  registration, lifecycle, sheet, and confirmation screens remain first-class content even
  when they are difficult or impossible to replay in the current app state.
- A single immediate context tile may be mechanically derived when an unambiguous direct route
  exists. It is optional presentation metadata and never changes the authored flow.
- Replay is best-effort derived output. V1 retains the existing direct forward/picker patterns;
  missing replay produces diagnostics rather than semantic failure. Adaptive live-state graph
  pathfinding is deferred.
- **One-screen flows are valid** when the destination independently communicates a useful
  intent, capability, state, or coherent set of options. Transient screens remain steps in
  the intent they support; unrelated sibling destinations are never bundled into tours.
- **Screen derivations are not flows or supporting interactions.** Data instances such as
  Gold, MetaDAO, and Wrapped BTC details, and lifecycle states such as Cards available,
  pending, and active, share one logical step when their intent and interaction structure are
  the same. One concrete primary member is authored; all members share coverage and
  `appearsIn` while remaining individually inspectable.
- A screen may occur locally in multiple flows when it supports different intents; this is
  repeated presentation, not ownership. Same-intent discoverability uses one flow plus
  `entryPoints`.
- Flow ids are the URL slugs within an already dated route. Existing flow URLs break with no
  redirects during this migration; after that, the same intent keeps the same id across
  captures, including after a temporary absence. Revival emits an advisory warning for human
  confirmation; a different intent may not take over that id. Dates and version suffixes do
  not belong in ids.
- Strict commit-time validation: drafts iterate in the validator CLI; committed captures are
  fully valid with an empty `flowTODO`; advisory review diagnostics do not fail the build.
- The dominator-tree segmenter is deleted, not kept as a candidate generator; the agent
  works from a deterministic post-SAF inventory, snapshots preferred over screenshots.
- Temporal re-capture and retention ship separately after a real development pilot. This
  plan preserves the agreed product requirements but deliberately does not freeze provenance,
  overlay, retirement, or re-binding schemas in the semantic release.
- Decision-point links are derived only for a unique target flow. Multiple local occurrences
  produce no link plus a diagnostic; there is no decision-screen owner and no tie-breaker.
- Strict all-capture validation is an accepted linear maintenance cost. Engine changes use
  the audit and mechanical migration commands, with affected semantic files reviewed in the
  same change.
- The semantic agent groups and names; the deterministic builder only validates and derives;
  `graph.json`, `flows.json`, and `view.json` keep distinct observation, semantic, and
  presentation responsibilities.

## Deliberately out of scope (v1)

- Adaptive replay planning from the currently matched live screen, including connector-path
  search, alternate account/lifecycle routes, and replay-only route hints.
- Entry points that reference a particular local step rather than the destination flow as a
  whole.
- Cross-links from other sections (dropped — entries + search cover discoverability).
- The captureTODO/"deepen" frontier loop (deferred, separate initiative).
- A hierarchical grouped list (kept flat; revisit only if deep trees read poorly).
- Cross-capture flow analytics (same id across dates enables it later; nothing built now).
- Temporal observation provenance, retained-graph overlay, re-capture policy, retirement,
  coverage proof, and reference re-binding. The follow-up requirements are recorded above,
  but their schema and implementation wait for the first real re-capture pilot.
