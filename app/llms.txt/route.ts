import fs from "fs"
import path from "path"

export const dynamic = "force-static"

// Read once at module load, not on every request (the route is force-static, so
// this resolves at build time regardless).
const indexPath = path.join(process.cwd(), "public/captures/index.json")
const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"))

export async function GET() {
  const appLines = index.apps
    .map(
      (app: { name: string; slug: string; platform: string; latest: string }) =>
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
