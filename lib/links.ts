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
