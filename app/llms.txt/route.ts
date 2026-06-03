import fs from "fs"
import path from "path"

export const dynamic = "force-static"

export async function GET() {
  const indexPath = path.join(
    process.cwd(),
    "public/captures/index.json"
  )
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"))

  const appLines = index.apps
    .map(
      (app: { name: string; slug: string; platform: string; latest: string }) =>
        `- ${app.name} (${app.platform.toUpperCase()}) — /captures/${app.slug}/${app.latest}/view.json`
    )
    .join("\n")

  const body = `# Inspo — Design Inspiration Gallery
> Captured UI flows from crypto wallet and fintech apps

## Apps

${appLines}

## Data

Each capture is a source graph.json (nodes, edges, decision points, overrides) and a
derived view.json (screens + flow tree with inline steps) produced from it at build time.
The gallery renders view.json. Screenshot paths are relative to the capture directory.

- GET /captures/index.json — App registry with slugs and capture dates
- GET /captures/{slug}/{date}/view.json — Derived view: screens + flow tree
- GET /captures/{slug}/{date}/graph.json — Source graph (nodes, edges, overrides)
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
