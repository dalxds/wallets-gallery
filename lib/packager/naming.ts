// Naming. A journey's mechanical name is deterministic; the LLM only improves it
// (mechanical names land in namingTODO and, once chosen, persist in
// overrides.flowNames keyed by the journey's NAME KEY — see nameKeyOf).

import type { GraphNode, Overrides } from "./types.ts"
import type { Journey } from "./segment.ts"

/**
 * The key `overrides.flowNames` is looked up by — decoupled from the routing slug. It is the
 * flow's first DISTINCTIVE screen (steps[1], the entry into its own trunk past the launch
 * screen it shares with its parent), or the launch screen itself for a single-step hub. Two
 * properties fall out:
 *   • cross-section copies share it — "Adding money" launched from Home and from Earn both key
 *     on `add-money-source`, so the name is authored ONCE (the routing slug stays unique).
 *   • it is the stable entry side, not the volatile goal/last screen — a churning end screen
 *     (a promo, a freshly added confirmation) no longer detaches a flow's authored name.
 */
export function nameKeyOf(journey: Journey): string {
  return journey.steps.length > 1 ? journey.steps[1] : journey.steps[0]
}

export function humanize(id: string): string {
  const s = id.replace(/[-_]+/g, " ").trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Screen title: override wins, else the node's most prominent short text, else humanized id. */
export function screenTitle(node: GraphNode, overrides: Overrides = {}): string {
  const ov = overrides.screens?.[node.id]?.title
  if (ov) return ov
  const firstText = node.texts.find((t) => t.trim().length > 0)
  if (firstText && firstText.length <= 32) return firstText
  return humanize(node.id)
}

export interface FlowName {
  name: string
  source: "override" | "mechanical"
}

/**
 * Strip what describes the SCREEN, not the journey: a flow is its intent, not the
 * specific data or state of its goal screen. Trailing parentheticals — the generic
 * place annotations like "(Owned)", "(External)", "(Needs Gas)" — are removed:
 * "Token Detail (Owned)" → "Token Detail"; "Help (External)" → "Help". No hardcoded
 * token/state word list (app-specific, drift-prone); this only shapes the mechanical
 * PLACEHOLDER name anyway — a real name comes from overrides.flowNames.
 */
export function cleanFlowName(title: string): string {
  let s = title.trim()
  while (/\([^)]*\)\s*$/.test(s)) s = s.replace(/\s*\([^)]*\)\s*$/, "").trim()
  return s || title
}

/**
 * Journey name: the authored override (looked up by the flow's NAME KEY, not its routing id)
 * if present, else a cleaned mechanical name from the flow's first distinctive screen. The
 * mechanical name is a deterministic FALLBACK only — the real name comes from the LLM/human via
 * overrides.flowNames, working from the whole journey (namingTODO carries the full step list).
 */
export function journeyName(journey: Journey, nameNode: GraphNode | undefined, overrides: Overrides = {}): FlowName {
  const ov = overrides.flowNames?.[nameKeyOf(journey)]
  if (ov) return { name: ov, source: "override" }
  const base = nameNode ? screenTitle(nameNode, overrides) : humanize(journey.goal)
  return { name: cleanFlowName(base), source: "mechanical" }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
