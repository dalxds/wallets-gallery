// Two URL roles, kept distinct:
//   • Navigation — appHref/dateHref. The latest capture lives at the clean,
//     evergreen /apps/[slug]; that URL tracks "latest" and is what in-app links
//     and the browse grid point at.
//   • Permalinks — captureHref/screenHref/flowHref. These ALWAYS pin the date
//     segment (/apps/[slug]/[date]?…), even for the latest capture, so a copied
//     or shared link resolves to exactly the capture that was on screen and never
//     drifts when a newer capture lands. They are the targets of the copy-link
//     affordances, never of in-app navigation.
// Deep links are query-param based (tab/flow/step/screen — the nuqs state the
// page reads); path-based URLs such as /apps/x/flows/y are not real routes.

export function appHref(appSlug: string): string {
  return `/apps/${appSlug}`
}

// Navigation to a capture date: the latest collapses to the clean /apps/[slug],
// every other date to /apps/[slug]/[date]. Each is its own prerendered page, so
// switching date is a navigation (no client fetch). Use this for the date picker
// and "view latest" — NOT for share links (those always pin; see captureHref).
export function dateHref(appSlug: string, date: string, latest: string): string {
  return date === latest ? `/apps/${appSlug}` : `/apps/${appSlug}/${date}`
}

// Permalink base for a capture — always the dated segment, so the link pins the
// capture regardless of whether it is currently the latest.
export function captureHref(appSlug: string, date: string): string {
  return `/apps/${appSlug}/${date}`
}

export function screenHref(
  appSlug: string,
  date: string,
  screenId: string
): string {
  return `${captureHref(appSlug, date)}?tab=screens&screen=${encodeURIComponent(screenId)}`
}

export function flowHref(
  appSlug: string,
  date: string,
  flowSlug: string,
  step?: number
): string {
  let href = `${captureHref(appSlug, date)}?tab=flows&flow=${encodeURIComponent(flowSlug)}`
  if (step != null) href += `&step=${step}`
  return href
}
