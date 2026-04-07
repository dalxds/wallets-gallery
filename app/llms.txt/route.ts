import fs from "fs"
import path from "path"

export async function GET() {
  const indexPath = path.join(
    process.cwd(),
    "public/captures/index.json"
  )
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"))

  const appLines = index.apps
    .map(
      (app: { name: string; slug: string; platform: string }) =>
        `- ${app.name} (${app.platform.toUpperCase()}) — /api/apps/${app.slug}/app.md`
    )
    .join("\n")

  const body = `# Inspo — Design Inspiration Gallery
> Captured UI flows from crypto wallet and fintech apps

## Apps

${appLines}

## API

- GET /api/apps/{slug}/app.md — Human/LLM-readable capture summary
- GET /api/apps/{slug}/app.md?date=YYYY-MM-DD — Specific capture date
- GET /captures/index.json — Machine-readable app registry
`

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
