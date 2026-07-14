// Deterministic screen-title helpers. Flow names and ids are authored in
// flows.json; the build never invents or repairs semantic names.

import type { GraphNode, Overrides } from "./types.ts"

export function humanize(id: string): string {
  const value = id.replace(/[-_]+/g, " ").trim()
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Override wins, then the first short visible text, then the humanized id. */
export function screenTitle(node: GraphNode, overrides: Overrides = {}): string {
  const override = overrides.screens?.[node.id]?.title
  if (override) return override
  const firstText = node.texts.find((text) => text.trim().length > 0)
  if (firstText && firstText.length <= 32) return firstText
  return humanize(node.id)
}
