// State classification.
//
// For each logical-screen family (from the SAF), label each member's state and detect
// in-place TOGGLES: a non-default variant joined to the family default by an `in-place`
// edge is the same screen in a different data/condition (renders as an on-step switcher),
// so it folds into the default's stateGroup instead of becoming a navigation step.
// Everything else stays an ordinary distinct screen.
//
// (An earlier version also routed non-toggle variants "divergent" vs "lifecycle" from a
// reachability comparison, but nothing consumed those values — segmentation only folds
// "toggle" — so that dead computation was removed.)

import type { GraphEdge, GraphNode, Overrides, StateLabel } from "./types.ts"
import type { SafResult } from "./saf.ts"

const RX_INSUFFICIENT = /\b(?:insufficient|not enough)\b/i
const RX_MAX = /\bmax(?:imum)?\b/i
// "unable to" dropped: in wallet copy it is usually an informational warning
// ("if you lose your phrase you'll be unable to recover"), not an error state.
const RX_ERROR = /\b(?:failed|error|try again|something went wrong|declined)\b/i
const RX_LOADING = /\b(?:loading|please wait|fetching|just a moment)\b/i
// Bound the gap between "no" and yet/found to 1-4 words. The old `no [a-z ]+(?:yet|found)`
// let `[a-z ]+` run greedily across whole sentences, so an unrelated later "…found" matched.
const RX_EMPTY = /\b(?:no (?:[a-z]+ ){1,4}(?:yet|found)|nothing here|empty|no transactions|no results|0 (?:transactions|items|results))\b/i

// A genuine loading screen is sparse (spinner + maybe a label/cancel). This guard
// stops a stray "Loading…" word on an otherwise-busy screen (e.g. a button mid-tap)
// from mislabelling the whole screen as loading.
const LOADING_MAX_ELEMENTS = 3

// Assigns the human STATE LABEL (empty/loading/error/max) to a screen from its text.
// These are generic UI-state words, not app vocabulary, and `overrides.screens[id].state`
// wins over any of them. Labeling is separate from DETECTION: whether a screen is a
// state variant at all is decided structurally (an in-place edge between two variants
// of one skeleton — see classify() below), not here.
export function stateLabel(n: GraphNode): StateLabel {
  const text = n.texts.join(" ")
  const insufficient = RX_INSUFFICIENT.test(text)
  // "max" only when an insufficiency signal accompanies it — a plain "Max" button
  // on the normal screen must not flip the default into a max state.
  if (RX_MAX.test(text) && insufficient) return "max"
  if (RX_ERROR.test(text) || insufficient) return "error"
  if (RX_LOADING.test(text) && n.interactiveElements.length <= LOADING_MAX_ELEMENTS) return "loading"
  if (RX_EMPTY.test(text)) return "empty"
  return "default"
}

export type Route = "default" | "toggle"

export interface ClassifyResult {
  /** canonical node id → state label */
  state: Map<string, StateLabel>
  /** canonical node id → stateGroup id (set only for toggle members: the default + its in-place variants) */
  stateGroup: Map<string, string>
  /** canonical node id → "default" or "toggle" (set for the family default and its in-place variants) */
  route: Map<string, Route>
  /** logical screen id → its default node id */
  defaultOf: Map<string, string>
}

export function classify(
  saf: SafResult,
  edges: GraphEdge[],
  overrides: Overrides = {}
): ClassifyResult {
  const nodeById = new Map(saf.canonicalNodes.map((n) => [n.id, n]))
  const ov = overrides.screens ?? {}

  const state = new Map<string, StateLabel>()
  for (const n of saf.canonicalNodes) state.set(n.id, ov[n.id]?.state ?? stateLabel(n))

  const stateGroup = new Map<string, string>()
  const route = new Map<string, Route>()
  const defaultOf = new Map<string, string>()

  for (const [logicalId, memberIds] of saf.members) {
    const members = memberIds.map((id) => nodeById.get(id)!).filter(Boolean)
    const defaults = members.filter((n) => state.get(n.id) === "default")
    // representative (members[0]) breaks ties when zero or multiple labelled defaults
    const def = defaults.length === 1 ? defaults[0] : members[0]
    defaultOf.set(logicalId, def.id)
    route.set(def.id, "default")
    if (members.length < 2) continue
    // The screen we crown as the group's default IS, by definition, its default state —
    // so a fallback representative isn't surfaced tagged "error"/"empty" in the switcher.
    if (defaults.length !== 1) state.set(def.id, "default")

    for (const v of members) {
      if (v.id === def.id) continue

      // Forced stateGroups (overrides.screens[id].stateGroup) are handled
      // authoritatively by the forced block below — keyed by the AUTHOR's group, not
      // this SAF family. Reacting to them here also folded the family's representative
      // default into an unrelated group (e.g. a screen that merely shares a skeleton).
      const inPlaceEdge = edges.some(
        (e) =>
          ((e.from === def.id && e.to === v.id) || (e.from === v.id && e.to === def.id)) &&
          e.kind === "in-place"
      )
      if (inPlaceEdge) {
        // structural toggle: same screen, in-place change. Group keyed by the family default.
        route.set(v.id, "toggle")
        stateGroup.set(v.id, def.id)
        stateGroup.set(def.id, def.id)
      }
      // A non-default, non-toggle member is just a distinct screen — no route entry needed.
    }
  }

  // Forced groups (overrides.screens[id].stateGroup) are authoritative: they form a
  // toggle group even if the SAF kept the variants in separate families. The default
  // is the member tagged state="default" (else the first), the rest are folded.
  const forced = new Map<string, string[]>()
  for (const n of saf.canonicalNodes) {
    const g = ov[n.id]?.stateGroup
    if (g) (forced.get(g) ?? forced.set(g, []).get(g)!).push(n.id)
  }
  for (const [g, ids] of forced) {
    // Default selection must be INPUT-ORDER-INDEPENDENT — the view has to be deterministic.
    // Precedence: the member the author explicitly tagged state:"default"; then the
    // eponymous node (a group is named after its default — overrides.stateGroup:"earn"
    // means `earn` is the default); then an auto-labelled default; else lexically first.
    // The previous `ids.find(state==="default") ?? ids[0]` tail picked by input order, so
    // reversing the node array flipped e.g. earn <-> earn-funded (default <-> toggle) and
    // reshaped the flow tree (folding `earn` stripped the edges feeding its sub-sections).
    const def =
      ids.find((id) => ov[id]?.state === "default") ??
      (ids.includes(g) ? g : undefined) ??
      [...ids].filter((id) => state.get(id) === "default").sort()[0] ??
      [...ids].sort()[0]
    defaultOf.set(g, def)
    for (const id of ids) {
      stateGroup.set(id, g)
      route.set(id, id === def ? "default" : "toggle")
    }
  }

  return { state, stateGroup, route, defaultOf }
}
