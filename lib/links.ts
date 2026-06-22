// Deep links are real routes, and every capture is canonical at its DATED URL:
// /apps/[slug]/[date]. There is one route tree (the dated one); the bare
// /apps/[slug] is a 307 redirect to the latest date. So every builder below takes
// the capture date and produces an always-dated URL — there's no "clean latest"
// form to drift from. Screens and flows are sub-routes of the capture base —
// opened as an intercepted modal in-app, and rendered as a full standalone page
// (with its own OG card) on a direct or shared link.

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
  step?: number
): string {
  const base = `${captureBase(appSlug, date)}/flow/${encodeURIComponent(flowSlug)}`
  return step != null ? `${base}?step=${step}` : base
}

// The Flows tab of a capture's gallery — its own prerendered route. (The Screens
// tab is the capture base itself, so callers use captureBase directly.) Used by a
// standalone flow page's "back to flows" link.
export function flowsHref(appSlug: string, date: string): string {
  return `${captureBase(appSlug, date)}/flows`
}

// Parse a ?step deep-link param to a 0-based step index, clamped into
// [0, count-1]. Tolerates a missing, non-numeric, negative, or overflowing value
// (a stale or hand-edited link, or a step that no longer exists after a
// re-capture) by landing on the nearest valid step instead of silently failing
// to center. `count` is the flow's step count.
export function parseStepParam(raw: string | undefined, count: number): number {
  const n = raw ? parseInt(raw, 10) : 0
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(count - 1, n))
}
