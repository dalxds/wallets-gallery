// Absolute origins for server-side URL building. Two distinct needs:

// `siteUrl` — the canonical/production origin, used for metadataBase (the
// absolute canonical + OG <meta> URLs emitted into the HTML). Prefer an explicit
// NEXT_PUBLIC_SITE_URL; on Vercel fall back to the production deploy URL; locally
// to localhost.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

// `assetBaseUrl` — the origin the server-side OG renderer fetches /captures assets from
// (lib/og.tsx composites the screenshot PNGs into each card). It MUST be a PUBLICLY reachable
// origin, and fetching over HTTP — not readFileSync from the bundle — keeps the OG functions
// code-only (wouldn't scale to ~50k screenshots). Environment matrix:
//
//   • production                → the production origin (siteUrl → VERCEL_PROJECT_PRODUCTION_URL).
//   • preview + bypass secret   → the deployment's OWN origin (VERCEL_URL), so a preview's OG cards
//       composite THAT deploy's new/changed captures (the "check share cards on preview before
//       prod" path). `x-vercel-protection-bypass` (VERCEL_AUTOMATION_BYPASS_SECRET) stops Standard
//       Deployment Protection 302-redirecting the self-fetch to SSO — the login page, not the PNG,
//       was why commit 760403b moved to the production origin in the first place.
//   • preview WITHOUT the secret → fall back to the production origin (today's behavior: a
//       protected preview reads production captures rather than rendering blank frames). So absent
//       the secret this change is a no-op — production is byte-identical either way.
//   • local dev                 → siteUrl (localhost).
//
// force-cache is kept: Vercel scopes the Data Cache per-environment (previews isolated from
// production) and every asset URL is content-addressed (screenshots by hash, logo by `?v=`), so a
// stale or 404 entry can't leak across environments or outlive a content change.
const previewOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const useOwnOrigin = process.env.VERCEL_ENV === "preview" && !!bypassSecret && !!previewOrigin

export const assetBaseUrl = useOwnOrigin ? previewOrigin! : siteUrl

// Sent only on the /captures asset fetch (lib/og.tsx imgDataUrl), only when self-fetching a
// protected preview — never on production, local dev, or the external avatar fallback.
export const assetFetchHeaders: Record<string, string> = useOwnOrigin
  ? { "x-vercel-protection-bypass": bypassSecret! }
  : {}
