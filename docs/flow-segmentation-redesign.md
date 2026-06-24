# Flow segmentation redesign

Design note for reworking how screens are packaged into flows (`lib/packager/segment.ts`,
with touchpoints in `index.ts` and `naming.ts`). Captures the decisions from the review
discussion and stages the work. **Stage 1 is implemented and committed (app v2.1.0); Stages
2–4 below are still the spec to build against.** Line-number references predate the Stage 1
edits — treat them as approximate and grep for the named symbols.

The packager front-end (SAF merge/cluster + classify toggles) is sound and stays as-is.
Everything below is about **segmentation**: turning the canonicalized edge graph into the
flow tree.

---

## Goals

1. A declared section never disappears *silently* and reads as itself: an empty `mainNav`
   section warns (`uncapturedSections`) instead of vanishing (Avici's `card`), and a flow is
   named from its full journey by the LLM, not mislabeled by a downstream sheet (Avici's `grow`).
2. Pickers and sheets are part of the journey, not hidden in the Screens tab.
3. The Flows view reflects **what a screen offers**, not just **what the walk happened to
   tap** — using authored `decisionPoints`.
4. Replace the brittle "distance from nearest entry" forward heuristic with a principled
   structure (dominator tree) that subsumes today's special cases.

Determinism is non-negotiable throughout: reordering `nodes`/`edges` must not change the view.

---

## Locked decisions

- **`MAX_TRUNK = 20`** (was 14). Onboarding (`creating-an-account`) is 13 today; 20 gives real
  headroom. Plus a diagnostic (below) so a future cap-hit is never silent.
- **An empty `mainNav` section warns; it is not force-shown.** When a declared section produced
  no journey (Avici's `card`, whose only link leads to another tab — a *capture gap*, since the
  guest walk was gated before exploring it), the packager reports it in `view.uncapturedSections`
  and `build-data` prints a warning ("walk past these tabs and re-capture"). It is **not**
  rendered as a lonely one-screen flow — that would paper over the gap. The section's screen
  stays browsable in the Screens tab; the fix is to capture its contents, after which it becomes
  a real section on its own. (Earlier draft force-kept a `[card]` flow; rejected — the original
  bug was *silent* vanishing, and a loud warning cures that without manufacturing content.)

---

## 1. Anchor naming, not forced altitude

**Rejected:** forcing every single-child anchor into its own hub level (manufacturing a
"Grow" hub over a single "Stablecoin Yields" child). If a section is one journey, one flow is
the honest representation — a 1-child hub is just clutter.

**Adopted:** keep the natural altitude (branchy anchors are hubs with children; single-child
anchors run the trunk straight through), and fix the actual defect, which is **naming**.

**Altitude rule — an anchor's altitude follows its surviving-journey count:**

| journeys under the anchor | result |
| --- | --- |
| **0** (rare) | no flow — the empty section warns via `uncapturedSections` (Stage 1, done); the screen stays browsable in Screens |
| **1** | **one flow** = anchor + that journey's steps (`[grow → grow-stablecoin-yields → …]`); name from the LLM (mechanical fallback `steps[1]`). **Not** a `[grow]` hub with a single child tucked under it. |
| **2+** | a hub `[anchor]` with the journeys as children (`earn`, `markets`) |

A "journey/child" is counted **after pickers are pulled out (§2) and after dropped/merged
branches settle**. So a screen that appeared to branch into `{picker, one real journey}`
collapses to that single journey — the picker is an excursion, not a child. This is the
"never tuck a lone child under a one-journey anchor" rule, and it falls out for free once
pickers stop counting as branches. The same collapse applies to any hub, not just top-level
anchors: a hub left with one surviving child after pickers/drops becomes a single flow.

The mechanical name is named after `steps[1]` (the first distinctive screen). That's a fine
*fallback* for a journey ("Sending money") but wrong for a section that absorbed its trunk:
Avici's Grow tab reads as **"Stablecoin Yields"**, even though the `grow` screen itself says
**"Grow Balance"**.

**Decision (revised — naming is the LLM's job, not a heuristic):** the mechanical name is only a
deterministic *fallback*; the real name comes from the LLM/human via `overrides.flowNames`. So:

- Keep the mechanical fallback **dumb**: `steps[1]`, else `goal`. No section special-case.
- **Drop the `anchorRoot` flag.** An earlier draft stamped each flow at build time to tell a
  section's own flow from a child re-parented to root, so the mechanical name could say "Grow".
  Removed — it duplicated info already derivable from `mainNav` + `overrides`, and is moot once
  the LLM names everything. (The capture never produces it; it was packager-internal.)
- **Give the namer the whole journey.** `namingTODO` now carries `steps: [{ id, title }]` per
  unnamed flow, so the LLM names "Grow" / "Withdraw to bank" from the *full* step list. The
  mechanical "Stablecoin Yields" is just the placeholder until that runs.

So Grow becomes "Grow" via the LLM (which sees `grow → grow-stablecoin-yields → …`), not via a
heuristic. Altitude (the table above) is unchanged and independent of naming.

---

## 2. Pickers & sheets are steps

**Decision:** keep **all** overlays/sheets as flow steps — pickers *and* informational sheets.
We're not building an info-sheet skip classifier (earlier idea, dropped): the cost of
occasionally carrying a "how it works" sheet is lower than the risk of dropping something
load-bearing, and "you can't swap without picking a coin" means the picker is a genuine step,
not a detour to hide.

Today `isSideTarget` (`segment.ts:115`) demotes any overlay that only returns to its launcher,
so `country-picker`, `add-funds-method-picker`, etc. never appear in a flow. We remove that
demotion. Two real problems have to be handled when we do:

### 2a. The return-to-launcher case (don't truncate or shatter the trunk)

A picker's *result* state is usually not its own node. Tuyo records the country picker as:

```
country-residence  --[overlay] "Tap Select country"-->  country-picker
country-picker     --[nav]     "Select United States"-->  country-residence
country-residence  --[nav]     "Tap Continue"-->          top-up
```

There is a **single** `country-residence` node, and its texts are the *empty* state
(`"Select country"`, no `"United States"`) — the "now-filled residence" the user actually sees
on return was never captured as a distinct node. So the picker's return edge loops back to the
launcher. (At the UX level you return to a *changed* screen; at the graph level it's the same
node, holding the pre-selection state.) `add-funds-method-picker → add-funds-amount` is
identical.

Naively threading this in fails two ways:
1. **Misleading state** — re-showing `country-residence` after the pick shows the *empty*
   placeholder ("you just chose United States" → screen says "Select country").
2. **Shattered trunk** — if `country-picker` is treated as a forward continuation,
   `country-residence` gains a second continuation and becomes a **branch point**, fragmenting
   the linear onboarding (and the `seen`-set at `segment.ts:165` blocks re-adding the launcher,
   truncating what's left).

**Handling:** a picker/overlay that returns to its launcher `S` is woven in as an **excursion
step** anchored to `S`; it is *not* a branch. The trunk's forward spine continues from **`S`'s
advancing exit**, not from the picker's return edge:

```
… → S(form) → P(picker, excursion · "Select United States") → next(via S→next) → …
```

`S` is not duplicated, not re-shown empty, and not turned into a branch point. The picker step
records how it was opened (`S→P` action) and carries the selection action; it's tagged
`kind: "picker"`. **DECIDED: the marker is internal** — a picker renders as a normal step in
the list, identical to any other. `kind` exists only so the path stays honest and replay knows
to do open→select→continue (it does *not* mean "lesser" or "hidden"). A subtle visual treatment
is allowed later but is not required.

**Linear alternative (more faithful, capture-dependent):** if the capture *does* keep the
post-selection state as a distinct node — `country-residence(empty) → country-picker →
country-residence("United States") → top-up` — the picker is just an ordinary forward step and
no excursion handling is needed. Whether to keep that result state distinct is a capture/SAF
granularity call (you don't want to snapshot every form field's before/after, but a dedicated
picker's result can be worth it). Segmentation supports **both shapes under one
`kind:"picker"`** and prefers the linear form when the result node exists.

> **ViewStep gains a `kind`** (`forward | picker`), defaulting to `forward`. This is the one
> view-schema change; everything else is internal. (Schema change ⇒ MAJOR per CLAUDE.md.)

### 2b. Picker options are content, not journeys

A picker must **not** spawn a child flow per option (a coin picker with 50 assets must not
become 50 flows). Its options are listed as the picker step's content. Whether an option is a
"picker option" vs a "real branch" is decided in §3 (diverge vs converge), driven by
`decisionPoints`.

### 2c. Homogeneous detail fan-out (the asset-row case)

A related shape, surfaced by Avici's Markets: tapping any asset row **navigates** to that
asset's detail screen — `markets → {spacex-detail, gold-detail, metadao-detail, wbtc-detail, …}`.
These are *not* return-pickers (they go forward, sometimes deep: `spacex-detail → buy-amount →
buy-review → execute`), but they're the same "one pattern, N instances, you only explore some"
situation as picker options (your Concern C). The `markets-guest` decisionPoint even lumps them
as a single option, `"… asset rows"`. We should **not** emit one top-level child flow per asset.
Proposed treatment (see open question): represent **one "View an asset / Buy" journey** using
the deepest explored instance as the exemplar (`spacex-detail → … → execute`), and treat the
other captured details (`gold`, `metadao`, `wbtc`) as **instances of that step**, browsable but
not their own flows — mirroring how a picker's options are content, not journeys.

### Replay implication

Weaving a picker into the spine means replay must open the picker, make a selection, and
continue. `buildReplay` (`replay.ts`) currently walks `steps` pairwise; with an excursion step
inserted, it needs to emit the open+select for the excursion and then the `S→next` click.
Tracked as part of this work, not an afterthought.

---

## 3. `decisionPoints` as authoritative branch truth

Today segmentation derives branches purely from observed out-edges and ignores
`decisionPoints` (they're only cross-referenced for `flowSlug` at `index.ts:135`). That makes
the tree a transcript of the walk, not a model of the app. We invert this: at a node that has
a `decisionPoint`, its **options are the authoritative branch set**.

This buys three things:

1. **Completeness.** `add-funds-method-picker` has 3 options (`Easy bank transfer`,
   `Debit or credit card`, `Transfer stablecoins`) but only the last was explored. The tree
   shows all three — explored options carry their steps; unexplored options render as labeled
   **stubs** ("not captured"), so the view says "this screen offers 3 methods" instead of
   silently showing one. (`send-recipient` has 3, `add-money-source` has 6 — all currently
   collapsed to whatever was walked.)
2. **Order.** Child flows / options are ordered by the decisionPoint's option order, not
   lexically by node id (today's `distOf || a<b`, `segment.ts:123`, renders Settings'
   children alphabetically). Falls back to edge `observedAtStep`, then lexical, for
   determinism when no decisionPoint exists.
3. **Diverge vs converge** (the picker test). For a node's options:
   - options whose targets **reconverge** (all return to the launcher, or all lead to the same
     next screen) ⇒ this is a **picker**; render options as content (§2b), no child flows.
   - options whose targets **diverge** into different downstream journeys ⇒ real branches; each
     explored one is a child flow, each unexplored one a stub.

   `country-picker` (all options → back to `country-residence`) is convergent ⇒ picker.
   `home` (Send / Receive / Trade → distinct journeys) is divergent ⇒ children. The
   `add-funds-method-picker` case is the instructive middle: it returns to its launcher
   (convergent today, because only one option was walked), but its three methods would diverge
   if explored — so it renders as a picker step *whose options are the three methods*, with the
   explored one optionally promoted to a child if its journey actually diverges. Your Concern C
   ("you only ever explore one option anyway") is precisely why we lean on the authored option
   list rather than the walked edges.

`decisionPoints` is authored data and already deterministic; option order is author-controlled,
which is what we want driving display order.

---

## 4. Core: dominator tree over the nav/overlay subgraph (north-star)

Everything above is implementable on today's `build()`/completion machinery, but that machinery
is a pile of compensations for one weak signal — "forward = larger BFS distance from nearest
entry" (`segment.ts:78,107`). The `>=` DAG-shortcut patch, `leadsOnward`, `isSideTarget`,
`reachesHub`, and the *separate* feature-vs-completion regimes all exist to paper over that
proxy. The principled replacement is a **dominator tree**.

### Construction

- Subgraph: `nav` + `overlay` edges (drop `back`; `in-place` already handled by classify).
- A virtual **super-source** `⊤` with an edge to every anchor (entries ∪ hubs ∪ `mainNav`
  roots).
- Compute immediate dominators (`idom`) from `⊤` (Lengauer–Tarjan, or the simple iterative
  Cooper–Harvey–Kennedy fixpoint — small graphs, and iterative is trivially deterministic).
- The **dominator tree is the flow tree.** `idom(X)` = the screen you must pass through to
  reach `X`. A chain in the tree (each node dominating exactly one branch-bearing child) is a
  **trunk**; a node that immediately dominates ≥2 is a **hub**.

### What it subsumes

- **`isSideTarget` / `leadsOnward`** → a picker is dominated by its form and dominates nothing
  downstream: structurally a leaf excursion. No bespoke side-screen test.
- **feature vs completion** → a hub is just an anchor (an `idom = ⊤` node); a journey that ends
  at a hub is a trunk whose tail is a dominated hub. One pass, no second `shortestToHub`
  regime, no "returns home flips a feature into a completion flow" artifact.
- **the distance-proxy mis-drop** (confirmed on avici, post–Stage 1). Avici's SpaceX buy is
  `markets → spacex-detail → buy-amount → buy-review(confirm) → high-impact-warning(execute) →
  markets`, but the flow **stops at `buy-amount`** — `buy-review` and `high-impact-warning` are
  dropped (verified: `appearsIn: []`). Root cause is *not* hub exclusion (Markets is a nav root,
  not a completion hub, so `featureConts`/`reachesHub` never fire here) — it's `isSideTarget` +
  the BFS distance proxy: `buy-review`'s only exit is an overlay to `high-impact-warning`, which
  is **shared with the Swap flow** and reached far more cheaply (`markets → swap →
  high-impact-warning`), so it carries a *low* distance-from-entry. `isSideTarget(buy-review)`
  then sees an exit to a lower-distance node, flags `buy-review` as a side-screen, and cuts the
  trunk. The dominator tree removes the proxy: `buy-review` is dominated by `buy-amount` (only it
  reaches `buy-review`) so it stays in the buy trunk; `high-impact-warning`, reached from both
  `buy-review` and `swap`, is dominated by their nearest common ancestor (the Markets hub) and
  becomes a **shared execute leaf** under Markets — a convergent-sheet case the implementation
  must handle (a sheet reached from N flows lands at the common dominator, not duplicated into
  each). Swap is the same shape.
- **`reachesHub`** → unnecessary; reaching a hub is just an edge to a node that happens to be an
  anchor.

### Cross-section journeys: duplicate, share the name (DECIDED — review issue #2)

`add-money-source` is reachable from both `home` and `earn`. **Decision: keep a copy nested
under each section** (`adding-money` under Home, a copy under Earn) — *not* hoisted to a single
canonical spot — because a user expects to find "Adding money" inside whichever tab they're in.
What changes is only the **naming burden**: the two copies **share one stable id** so the name
is authored once and both inherit it. Today they have separate ids (`add-money-source` and
`add-money-source@earn`), which is why tuyo carries 8-of-29 duplicate `flowNames` keys; under
the shared id that collapses to one.

> **Interaction with the dominator tree (§4):** the tree's *natural* output hoists a
> multiply-reachable node to its common dominator (dedup). That conflicts with this decision,
> so the dominator pass governs **trunk/nesting structure only**; a journey reachable from N
> sections is then **re-emitted under each reaching section** (as today), with a shared
> trunk-keyed name. Dedup-by-hoisting is explicitly *not* adopted.

Mechanics: **decouple the routing slug from the name key.** Each copy keeps a unique `slug`
(unique URL/route), but its `name`/override is looked up by a **trunk-based key** (the distinctive
entry + trunk, independent of parent) that is identical across copies. See §5.

### Stable-id / name-key fix (review issue #5 + the §4 shared-name decision)

Two problems with today's goal-based stable id (`segment.ts:260`):

1. **Anchored to the volatile end.** `creating-an-account` is keyed to `whats-new-promo`, a
   promo screen that churns between captures, silently detaching the override name.
2. **Parent-scoped, so cross-section copies don't share a name** (the `@earn` suffix problem).

Fix both by **decoupling the routing slug from the name key**:

- **`slug`** (route/URL) stays unique per flow, as today.
- **name key** (what `overrides.flowNames` is keyed on) becomes a **trunk key**: the distinctive
  entry (`steps[1]`, the stable entry side — matching the §1 naming anchor) + the trunk shape,
  **independent of parent and of the goal/last screen**. So the two "Adding money" copies hash
  to the *same* name key (author once, §4), and a one-screen change to a flow's *tail* no longer
  detaches its name.

Determinism is preserved: the trunk key is a pure function of the (ordered) step ids.

---

## Staged plan

Stages 1–2 are independent quick wins on the current algorithm; 3–4 are the model rework. Each
stage ends green on `pnpm build-data && pnpm test` with regenerated `view.json` committed.

**Stage 1 — safety + naming context (MINOR; additive view fields only)** ✅ DONE
- `MAX_TRUNK = 20`; `stats.truncatedFlows` + a `build-data` warning when a trunk caps.
- Empty `mainNav` section → `view.uncapturedSections` + a `build-data` warning (NOT force-shown).
- Naming: keep the dumb mechanical fallback (`steps[1]`/goal); enrich `namingTODO` with the full
  `steps` list so the LLM names from the whole journey. No `anchorRoot`/section-name heuristic.
- `leadsOnward` counts `overlay` edges (not just `nav`), so sheet-driven journeys (avici buy/swap)
  aren't mistaken for dead-ends. (Pre-existing tweak, folded into this PR + CHANGELOG.)
- Tests: `namingTODO` carries each flow's full step list; empty section warns + lands in
  `uncapturedSections`, not in flows; over-long trunk → cap + `truncatedFlows`.

**Stage 2 — decisionPoints-driven order + completeness (MINOR)** ✅ DONE (app v2.2.0)
- Order children/options by decisionPoint option order → `observedAtStep` → lexical.
- Surface unexplored options as stubs.
- Tests pin Settings child order and `add-funds-method-picker`'s 3-option completeness.

**Stage 4 — dominator-tree core (MAJOR — internal; routes stable) — built before Stage 3.** ✅ DONE
- Replaced the distance heuristic + `build`/`shortestToHub`/`isSideTarget`/`reachesHub`/`leadsOnward`
  with a dominator tree over the nav/overlay subgraph (super-source → anchors; iterative
  Cooper–Harvey–Kennedy idom). Excursions (return-to-launcher pickers/peeks) are detected
  structurally and held out of flows; cross-section journeys are re-emitted under each reaching
  section (no hoist/dedup). Name key decoupled from routing slug (`steps[1]`, parent-independent)
  so cross-section copies share one authored name and a churning goal no longer detaches it —
  `view.namingTODO[].nameKey` surfaces it; `overrides.flowNames` is now keyed by it.
- **Build-order note:** the spec numbers pickers (3) before the core (4), but Stage 4 *removes* the
  machinery Stage 3 would otherwise patch (the distance proxy / `isSideTarget`), so the dominator
  core was built first (per the implementation recommendation). With the core in place, forward
  sheets already surface as steps; only the return-to-launcher excursions wait for Stage 3.

**Stage 3 — pickers/sheets as steps woven on the dominator core (MAJOR — `ViewStep.kind`)**
- Weave the held-out excursions back in as inline `kind:"picker"` steps without truncating the
  trunk (§2a); options as content via diverge/converge (§2b/§3); collapse the homogeneous detail
  fan-out (§2c).
- Update `buildReplay` for excursion steps.
- Tests: `country-picker` appears as a `kind:"picker"` step; trunk past it is intact; a
  multi-asset picker does not spawn N flows.

CLAUDE.md note: Stages 3–4 touch the view schema / published flow shape ⇒ MAJOR bump +
CHANGELOG entry; Stages 1–2 are MINOR. Captures are content, re-derived, not versioned.

---

## Determinism & test checklist

- No clock/random/input-order dependence (the standing invariant). The iterative dominator
  fixpoint and decisionPoint-driven ordering are both order-independent; keep lexical
  tie-breaks as the final arbiter.
- `tests/packaging/packager.test.ts` already pins: side-pickers-not-flows (will **invert** in
  Stage 3 — pickers become steps), in-place→toggle, nav-root top-level, override survival,
  cycle-proof hubs. Update the picker expectations deliberately and add the §-specific cases.
- Re-run `pnpm build-data` and eyeball the tuyo/avici flow trees after every stage (the golden
  artifacts are the real regression surface).

---

## Resolved decisions

- **Cross-section shared journeys (§4):** keep per-section duplicates; share one trunk-keyed
  name so it's authored once. Dominator hoisting/dedup is *not* adopted.
- **Excursion rendering (§2a):** the `kind:"picker"` marker is **internal**; a picker renders as
  a normal step in the flow. No required visual distinction.

## Open questions

1. **Homogeneous detail fan-out (§2c):** confirm the "one Buy/View-asset journey + other details
   as instances" treatment, vs. one child flow per explored asset. (Recommended: one journey +
   instances.) Needs a signal for "these N nav-targets are instances of one pattern" — the
   `decisionPoints` lumped option (`"… asset rows"`) is the natural one; the deepest-explored
   instance is the exemplar.
2. **Picker result state:** should the capture skill start keeping a picker's *result* state
   distinct (enabling the §2a linear form) when it's meaningful, or always rely on the excursion
   shape? A capture-side call, not segmentation — but it changes how faithful pickers look.
3. **Unexplored stubs in replay:** a stub option has no selector — confirm it's simply omitted
   from the replay script (replay covers the explored spine only).
