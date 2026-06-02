// Deep links are query-param based on the single /apps/[slug] route, matching
// the nuqs query state the page reads (tab/flow/step/screen). Path-based URLs
// such as /apps/x/flows/y are not real routes and would 404.

export function appHref(appSlug: string): string {
  return `/apps/${appSlug}`
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
