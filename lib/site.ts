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

// `assetBaseUrl` — the origin the server-side OG renderer fetches /captures assets
// from (lib/og.tsx composites the screenshot PNGs into each card). It MUST be a
// PUBLICLY reachable origin, so it reuses the canonical `siteUrl` (which resolves to
// VERCEL_PROJECT_PRODUCTION_URL — the shortest production domain). This follows
// Vercel's own guidance: VERCEL_URL (the team-scoped `*.vercel.app` this used to
// use) "cannot be used in conjunction with Standard Deployment Protection" — it
// 302-redirects to SSO, so a function fetching its own deployment's screenshots got
// the login page, not the PNG, and cards rendered blank; and the docs recommend
// VERCEL_PROJECT_PRODUCTION_URL "to reliably generate links that point to production
// such as OG-image URLs". (Trade-off: a protected preview now reads PRODUCTION's
// captures, not its own — fine, since it can't serve OG to scrapers anyway, and new
// captures are validated locally first. To restore per-deploy isolation, generate a
// Protection Bypass for Automation secret — VERCEL_AUTOMATION_BYPASS_SECRET — and
// send it as the `x-vercel-protection-bypass` header while fetching VERCEL_URL.)
// Fetching over HTTP — not readFileSync from the bundle — keeps the OG functions
// code-only (wouldn't scale to ~50k screenshots).
export const assetBaseUrl = siteUrl
