// Closes a stale modal on a soft-nav to a non-intercepted route under
// /apps/[slug]/[date] (e.g. a tab or date switch): the @modal slot resolves to
// null instead of keeping the previous intercept mounted.
export default function CatchAll() {
  return null
}
