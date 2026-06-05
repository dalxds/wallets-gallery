// State classification + routing.
//
// For each logical-screen family (from the SAF), label each member's state and
// decide how a non-default variant relates to the default — the three homes:
//   toggle     — same screen, in-place data/condition change (an `in-place` edge
//                between default and variant). Renders as an on-step switcher.
//   divergent  — the variant opens screens the default never reaches (a different
//                multi-screen path). Becomes a sibling flow.
//   lifecycle  — a stage on the way to the default (empty → … → funded). A normal
//                step in whatever journey traverses it.

import type { GraphEdge, GraphNode, Overrides, StateLabel } from "./types.ts"
import type { Adjacency } from "./graph.ts"
import { reachableFrom } from "./graph.ts"
import type { SafResult } from "./saf.ts"

const RX_INSUFFICIENT = /\b(?:insufficient|not enough)\b/i
const RX_MAX = /\bmax(?:imum)?\b/i
const RX_ERROR = /\b(?:failed|error|try again|something went wrong|declined|unable to)\b/i
const RX_LOADING = /\b(?:loading|please wait|fetching|just a moment)\b/i
const RX_EMPTY = /\b(?:no [a-z ]+(?:yet|found)|nothing here|empty|no transactions|no results|0 (?:transactions|items|results))\b/i

export function stateLabel(n: GraphNode): StateLabel {
  const text = n.texts.join(" ")
  const insufficient = RX_INSUFFICIENT.test(text)
  // "max" only when an insufficiency signal accompanies it — a plain "Max" button
  // on the normal screen must not flip the default into a max state.
  if (RX_MAX.test(text) && insufficient) return "max"
  if (RX_ERROR.test(text) || insufficient) return "error"
  if (RX_LOADING.test(text) && n.interactiveElements.length <= 3) return "loading"
  if (RX_EMPTY.test(text)) return "empty"
  return "default"
}

export type Route = "default" | "toggle" | "divergent" | "lifecycle"

export interface ClassifyResult {
  /** canonical node id → state label */
  state: Map<string, StateLabel>
  /** canonical node id → stateGroup id (set only for toggle members: the default + its in-place variants) */
  stateGroup: Map<string, string>
  /** canonical node id → routing decision */
  route: Map<string, Route>
  /** logical screen id → its default node id */
  defaultOf: Map<string, string>
}

export function classify(
  saf: SafResult,
  adj: Adjacency,
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

    for (const v of members) {
      if (v.id === def.id) continue

      const forcedGroup = ov[v.id]?.stateGroup
      const inPlaceEdge = edges.some(
        (e) =>
          ((e.from === def.id && e.to === v.id) || (e.from === v.id && e.to === def.id)) &&
          e.kind === "in-place"
      )

      // does v reach screens the default cannot (each without going through the other)?
      const fromV = reachableFrom(adj, v.id, { exclude: new Set([def.id]) })
      const fromD = reachableFrom(adj, def.id, { exclude: new Set([v.id]) })
      const opensNew = [...fromV].some((x) => x !== v.id && x !== def.id && !fromD.has(x))

      if (forcedGroup || inPlaceEdge) {
        // group is keyed by its DEFAULT screen, not the SAF representative
        route.set(v.id, "toggle")
        stateGroup.set(v.id, forcedGroup ?? def.id)
        stateGroup.set(def.id, forcedGroup ?? def.id)
      } else if (opensNew) {
        route.set(v.id, "divergent")
      } else {
        route.set(v.id, "lifecycle")
      }
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
    const def = ids.find((id) => (ov[id]?.state ?? state.get(id)) === "default") ?? ids[0]
    defaultOf.set(g, def)
    for (const id of ids) {
      stateGroup.set(id, g)
      route.set(id, id === def ? "default" : "toggle")
    }
  }

  return { state, stateGroup, route, defaultOf }
}
