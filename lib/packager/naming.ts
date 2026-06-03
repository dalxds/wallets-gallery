// Naming. A journey's name is goal-based and deterministic; the LLM only improves
// it (mechanical names land in namingTODO and, once chosen, persist in
// overrides.flowNames keyed by the journey id).

import type { GraphNode, Overrides } from "./types.ts"
import type { Journey } from "./segment.ts"

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

const LEADING_INSTANCE = /^(?:usdc|usdt|eth|btc|sol|bnb|matic|dai|weth|wbtc|virtual|degen|aero|base)\s+/i
const TRAILING_STATE = /\s+(?:max|funded|empty|owned|loading|error|default)$/i

/**
 * Strip what describes the SCREEN (not the journey): trailing parentheticals, a
 * leading instance token, and a trailing state word. A flow is its intent, not the
 * state or specific data of its goal screen. "USDC Token Detail (Owned)" → "Token
 * Detail"; "Help (External)" → "Help"; "Trade Max (Needs Gas)" → "Trade".
 */
export function cleanFlowName(title: string): string {
  let s = title.trim()
  while (/\([^)]*\)\s*$/.test(s)) s = s.replace(/\s*\([^)]*\)\s*$/, "").trim()
  s = s.replace(LEADING_INSTANCE, "").trim()
  s = s.replace(TRAILING_STATE, "").trim()
  return s || title
}

/** Journey name: override if present, else a cleaned mechanical name from the goal screen. */
export function journeyName(journey: Journey, goalNode: GraphNode | undefined, overrides: Overrides = {}): FlowName {
  const ov = overrides.flowNames?.[journey.id]
  if (ov) return { name: ov, source: "override" }
  const base = goalNode ? screenTitle(goalNode, overrides) : humanize(journey.goal)
  return { name: cleanFlowName(base), source: "mechanical" }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
