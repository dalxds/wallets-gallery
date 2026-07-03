import { readRegistry } from "@/lib/captures"

export const dynamic = "force-static"

export async function GET() {
  // The one canonical registry read (shared with the browse + /apps routes). The route is
  // force-static, so this resolves once at build time.
  const appLines = readRegistry()
    .apps.map(
      (app) =>
        `- ${app.name} (${app.platform.toUpperCase()}) — /captures/${app.slug}/${app.latest}/view.json`
    )
    .join("\n")

  const body = `# wallets.gallery
> A showcase of money apps curated by agents.

## Apps

${appLines}

## Data

Each capture is a source graph.json (nodes, edges, decision points, overrides) and a
derived view.json (screens + flow tree with inline steps) produced from it at build time.
The gallery renders view.json. Screenshot paths in view.json (e.g. "assets/ab12.png") are
relative to the app's capture root /captures/{slug}/ — NOT to the dated view.json URL:
"assets/ab12.png" → /captures/{slug}/assets/ab12.png. Assets are content-addressed and
shared across an app's captures, so they live above the per-date directories.

The app lines above already point at each app's latest view.json, so no date resolution is
needed to get the newest capture. To deep-link "latest" without reading this file or the
index, use the date-free alias, which 307-redirects to the newest dated file.

- GET /captures/index.json — App registry with slugs, capture history, and the latest pointer
- GET /captures/{slug}/{date}/view.json — Derived view: screens + flow tree
- GET /captures/{slug}/{date}/graph.json — Source graph (nodes, edges, overrides)
- GET /captures/{slug}/latest/view.json — 307 → the newest dated view.json (same for graph.json)
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
