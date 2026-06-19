// Deep links are real routes. The capture date drives the base: the latest
// capture lives at the clean /apps/[slug], every other date at
// /apps/[slug]/[date] (see captureBase). Screens and flows are sub-routes of
// that base — opened as an intercepted modal in-app, and rendered as a full
// standalone page (with its own OG card) on a direct or shared link.

export function appHref(appSlug: string): string {
  return `/apps/${appSlug}`
}

// Single source of truth for latest (clean) vs historical (dated) capture URLs.
// Everything that links into a capture builds on this, so the latest/date split
// can never drift between callers.
export function captureBase(
  appSlug: string,
  date: string,
  latest: string
): string {
  return date === latest ? `/apps/${appSlug}` : `/apps/${appSlug}/${date}`
}

// Switching capture date is a navigation to its own prerendered gallery page.
export function dateHref(appSlug: string, date: string, latest: string): string {
  return captureBase(appSlug, date, latest)
}

export function screenHref(
  appSlug: string,
  screenId: string,
  date: string,
  latest: string
): string {
  return `${captureBase(appSlug, date, latest)}/screen/${encodeURIComponent(screenId)}`
}

export function flowHref(
  appSlug: string,
  flowSlug: string,
  date: string,
  latest: string,
  step?: number
): string {
  const base = `${captureBase(appSlug, date, latest)}/flow/${encodeURIComponent(flowSlug)}`
  return step != null ? `${base}?step=${step}` : base
}

// Copy/share links PIN the capture date (always dated, even for the latest) so a
// shared link keeps resolving to the same capture after a newer one lands —
// unlike screenHref/flowHref above, which use the clean URL for the latest.
export function screenShareHref(
  appSlug: string,
  screenId: string,
  date: string
): string {
  return `/apps/${appSlug}/${date}/screen/${encodeURIComponent(screenId)}`
}

export function flowShareHref(
  appSlug: string,
  flowSlug: string,
  date: string,
  step?: number
): string {
  const base = `/apps/${appSlug}/${date}/flow/${encodeURIComponent(flowSlug)}`
  return step != null ? `${base}?step=${step}` : base
}

// Parse a ?step deep-link param to a 0-based step index, clamped into
// [0, count-1]. Tolerates a missing, non-numeric, negative, or overflowing value
// (a stale or hand-edited link, or a step that no longer exists after a
// re-capture) by landing on the nearest valid step instead of silently failing
// to center. `count` is the flow's step count.
export function parseStepParam(
  raw: string | undefined,
  count: number
): number {
  const n = raw ? parseInt(raw, 10) : 0
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(count - 1, n))
}

// The Flows tab of a capture's gallery — its own prerendered route. (The Screens
// tab is the capture base itself, so callers use captureBase directly.) Used by a
// standalone flow page's "back to flows" link.
export function flowsHref(appSlug: string, date: string, latest: string): string {
  return `${captureBase(appSlug, date, latest)}/flows`
}
