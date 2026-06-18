// Soft-navigations within /apps/[slug] that don't match an intercept (e.g. a tab
// change) resolve the slot here → null, so a stale modal doesn't linger. The
// (.)screen / (.)flow intercepts are more specific and take precedence.
export default function CatchAll() {
  return null
}
