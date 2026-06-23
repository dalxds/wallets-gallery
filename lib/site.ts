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

// `assetBaseUrl` — where THIS deployment serves its own /captures assets, for
// SERVER-side fetches (the OG cards composite screenshots into a PNG, so the
// function needs the bytes). Prefer the current deployment's own URL so a preview
// reads the captures in *that* deploy (not production); fall back to an explicit
// site URL, then localhost for `next start` / dev. Reading these over HTTP from
// the CDN — instead of readFileSync from the function bundle — keeps the OG
// functions code-only (no image bytes bundled, which wouldn't scale to ~50k
// screenshots and isn't reliably traced into the lambda anyway).
export const assetBaseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
