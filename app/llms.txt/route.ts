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
        `- ${app.name} (${app.platform.toUpperCase()}) — /captures/${app.slug}/${app.latest}/app.json`
    )
    .join("\n")

  const body = `# Inspo — Design Inspiration Gallery
> Captured UI flows from crypto wallet and fintech apps

## Apps

${appLines}

## Data

Each app.json contains the full capture: app metadata, screens, flows with inline steps, and decision points.
All screenshot paths are relative to the capture directory.

- GET /captures/index.json — App registry with slugs and capture dates
- GET /captures/{slug}/{date}/app.json — Full app capture data
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
