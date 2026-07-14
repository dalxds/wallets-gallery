// Deep links are real routes, and every capture is canonical at its DATED URL:
// /apps/[slug]/[date]. There is one route tree (the dated one); the bare
// /apps/[slug] is a 307 redirect to the latest date. So every builder below takes
// the capture date and produces an always-dated URL — there's no "clean latest"
// form to drift from. Screens and flows are sub-routes of the capture base —
// opened as an intercepted modal in-app, and rendered as a full standalone page
// (with its own OG card) on a direct or shared link.

import { variationParam } from "./variations"

// Single source of truth for a capture's URL. Everything that links into a
// capture builds on this, so the dated shape can never drift between callers.
export function captureBase(appSlug: string, date: string): string {
  return `/apps/${appSlug}/${date}`
}

export function screenHref(
  appSlug: string,
  screenId: string,
  date: string
): string {
  return `${captureBase(appSlug, date)}/screen/${encodeURIComponent(screenId)}`
}

export function flowHref(
  appSlug: string,
  flowSlug: string,
  date: string,
  // 1-based step number (matches the badge on the card); omit for the flow's
  // first step.
  step?: number,
  // Human-facing variation label rendered at the step (for example "Issued").
  variation?: string
): string {
  const base = `${captureBase(appSlug, date)}/flow/${encodeURIComponent(flowSlug)}`
  const params = new URLSearchParams()
  if (step != null) params.set("step", String(step))
  if (variation != null) {
    const normalizedVariation = variationParam(variation)
    if (!normalizedVariation)
      throw new Error("variation must have a URL-safe name")
    params.set("variation", normalizedVariation)
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

// The Flows tab of a capture's gallery — its own prerendered route. (The Screens
// tab is the capture base itself, so callers use captureBase directly.) Used by a
// standalone flow page's "back to flows" link.
export function flowsHref(appSlug: string, date: string): string {
  return `${captureBase(appSlug, date)}/flows`
}

// Resolve a ?step deep-link param (1-based, matching the badge) to a 0-based
// step index. An in-range value 1..count maps to its index. Anything else —
// non-numeric, below 1, or past the last step (a stale or hand-edited link, or a
// step that no longer exists after a re-capture) — lands on the FIRST step.
// `valid` is false only when a param was present but garbage/out of range, so
// the caller can strip the stale ?step from the URL; a missing param is valid
// (nothing to heal). `count` is the flow's step count.
export function parseStepParam(
  raw: string | undefined,
  count: number
): { index: number; valid: boolean } {
  if (raw == null) return { index: 0, valid: true }
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1 || n > count) return { index: 0, valid: false }
  return { index: n - 1, valid: true }
}
