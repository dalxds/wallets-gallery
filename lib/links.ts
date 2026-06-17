// Deep links are query-param based on the single /apps/[slug] route, matching
// the nuqs query state the page reads (tab/flow/step/screen). Path-based URLs
// such as /apps/x/flows/y are not real routes and would 404.

export function appHref(appSlug: string): string {
  return `/apps/${appSlug}`
}

// Capture date is a route segment: the latest lives at the clean /apps/[slug],
// every other date at /apps/[slug]/[date]. Each is its own prerendered page, so
// switching date is a navigation (no client fetch).
export function dateHref(appSlug: string, date: string, latest: string): string {
  return date === latest ? `/apps/${appSlug}` : `/apps/${appSlug}/${date}`
}

// Resolve a deep-link id (flow slug or screen id) to its current value, following
// at most one retired→current alias hop. Returns the param unchanged when it's
// already live or simply unknown. The lightbox islands use this so a link shared
// before a slug/id changed still opens the right thing (and then rewrites the URL
// to the canonical value). Links we generate always emit canonical ids, never aliases.
export function followAlias(param: string, aliases: Record<string, string> | undefined): string {
  return aliases?.[param] ?? param
}

export function screenHref(appSlug: string, screenId: string): string {
  return `/apps/${appSlug}?tab=screens&screen=${encodeURIComponent(screenId)}`
}

export function flowHref(
  appSlug: string,
  flowSlug: string,
  step?: number
): string {
  let href = `/apps/${appSlug}?tab=flows&flow=${encodeURIComponent(flowSlug)}`
  if (step != null) href += `&step=${step}`
  return href
}
