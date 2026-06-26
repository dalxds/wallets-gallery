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
        `- ${app.name} (${app.platform.toUpperCase()}) — /apps/${app.slug}/view.json`
    )
    .join("\n")

  const body = `# Wallets Gallery — Design Inspiration Gallery
> Captured UI flows from crypto wallet and fintech apps

## Apps

${appLines}

## Data

Each capture is a source graph.json (nodes, edges, decision points, overrides) and a
derived view.json (screens + flow tree with inline steps) produced from it at build time.
The gallery renders view.json. Screenshot paths are relative to the capture directory and
served under /captures/{slug}/.

- GET /index.json — App registry with slugs and capture dates
- GET /apps/{slug}/app.json — Per-app metadata and capture history
- GET /apps/{slug}/{date}/view.json — Derived view: screens + flow tree
- GET /apps/{slug}/{date}/graph.json — Source graph (nodes, edges, overrides)
- GET /apps/{slug}/view.json — Latest view (307 → newest dated URL); /graph.json likewise
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
