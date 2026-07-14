# Semantic flow grouping

Use this reference after assembly, when authoring `flows.json` from the deterministic
post-SAF inventory. Settle grouping before naming.

## Model

A flow is a reader-facing intent. Top-level flows represent the app's principal sections;
child flows represent outcomes or independently useful destinations. Top-level flows are
usable flows with local steps, not folders.

Each intent appears once in the tree. If another section visibly exposes the same intent,
record the source flow, source screen, and destination screen in `entryPoints`; do not
duplicate the flow. Parentage records the canonical place readers should find the intent.
Reachability and replay availability do not determine parentage.

## Grouping rules

- Group screens by a coherent user outcome, not graph branches, screen count, or replay shape.
- Every flow has at least one local step. A one-screen flow is appropriate only when that
  screen is an independently useful destination, not merely a wrapper or prelude.
- A section's single primary action sequence belongs in the section flow. Do not create a
  child merely to hold the continuation of the section's only meaningful journey.
- A chooser or hub normally needs at least two peer child intents or methods. If a parent has
  only one child, flatten them by default. When the parent contains one local screen and the
  child holds its sole continuation, append the child's steps to the parent, remove the child,
  and preserve the parent's id and name. Keep the child only when both parent and child are
  independently useful reader intents; the validator emits an advisory for human review.
- More generally, an entry screen or sequence with only one meaningful continuation belongs
  in one flow. Split only where the product exposes independent alternative intents or outcomes.
- Keep unrelated sibling destinations as separate flows. Never weave settings pages or other
  siblings into a tour merely to make a longer row.
- Different methods for one outcome are separate flows. The chooser is a natural parent hub;
  method children can use concise method nouns such as `Bank transfer` or `Card`.
- A transient sheet, picker, prerequisite, confirmation, or informational surface stays in
  the intent it supports when it is not independently useful.
- A promotional banner, first text node, or upsell does not define the semantic intent. Group
  from the screen's durable function, the action that opened it, and the outcome it supports.
- Captured content remains useful flow content even when it is difficult to replay.
- Direct graph adjacency is not required between authored steps. Order steps by how a reader
  should experience and understand the intent.
- A replay route may traverse screens from another semantic flow. Do not duplicate those
  connector screens into the destination flow for that reason.
- A screen may appear locally in more than one flow when it genuinely contributes to
  different intents. The generated `appearsIn` list records every occurrence.
- Put only chrome, capture noise, or genuinely non-useful surfaces in `uncovered`, with a
  specific reason. Replay difficulty is not a reason.

## Screen derivations

One logical screen shown with different data, entity, lifecycle state, ordinary UI state, or
carousel position is one flow step with multiple derivations. Author exactly one concrete
primary member in `steps`; the generated switcher exposes the others.

Examples include asset detail for Gold/MetaDAO/Wrapped BTC, Cards in available/pending/active
states, and a default/empty/error surface. A materially different interaction or outcome is a
different screen or flow, not a derivation.

Derivation membership does not imply identical downstream capabilities. Keep exact graph edges
and `entryPoints` on the concrete member that exposes an action: an Active card may open limits
while Available/Pending cards do not, even though all three remain one Cards step. The generated
context switcher filters to those concrete source members; do not split the derivation group or
duplicate the child flow to encode capability availability.

Audit the inventory's derivation groups before authoring flows. If members need correction,
edit `graph.json.overrides.screens[*].stateGroup` and `state`, regenerate the inventory, and
then continue. Derivations do not require transitions between one another.

## Parent selection

Choose one parent using this priority:

1. The section that most prominently presents the intent.
2. The section whose core purpose most closely matches it.
3. The app's visible information architecture and terminology.
4. Authored main-navigation order, then flow id, as a tie-break.

Alternate origins belong in `entryPoints`. Each record names `flowId`, `fromScreenId`, and
`toScreenId`, so the gallery can place navigation on the exact source and destination screen.
They are discoverability metadata, not replay starts or alternate tree nodes.

## Authoring pass

1. Read canonical screens, derivation groups, edges, decision points, and `mainNav` from the
   inventory.
2. Correct derivation identity before semantic grouping.
3. Group by intent and split methods at chooser hubs.
4. Run the hierarchy sanity pass: merge single-child wrappers, inline each section's primary
   sequence, and confirm every remaining child is independently useful.
5. Choose canonical parents without using replayability as evidence.
6. Author local steps, one member per derivation group.
7. Add exact screen-level entry records for alternate origins.
8. Account for every logical screen through a flow or `uncovered`.
9. Put unresolved semantic questions in `flowTODO`; do not guess silently. Committed packages
   have an empty `flowTODO`.

Naming is a separate pass applied after the semantic structure is stable. It does not decide
flow membership, hierarchy, or whether a child should exist; see [naming.md](naming.md).

The validator reports semantic errors and replay diagnostics separately. Missing replay never
changes grouping or makes a semantic package invalid.
