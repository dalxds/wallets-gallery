// Data build (run before `next build` and on demand).
//
// For every app under public/captures, for every capture date with a graph.json,
// run the packager → write the derived view.json that the app fetches. Then emit
// the registry (index.json) from the views.
//
// graph.json is the single committed source; view.json + index.json are
// generated artifacts.

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { packageGraph } from "../lib/packager/index.ts"
import type { Graph, View } from "../lib/packager/types.ts"

const capturesDir = join(process.cwd(), "public/captures")

interface RegistryEntry {
  slug: string
  name: string
  platform: string
  captures: string[]
  latest: string
  cover: string
  screens: number
  flows: number
  logo: string | null
}

// The browse page renders from index.json alone, so each entry needs a cover
// thumbnail. Prefer the home screen, but only one that actually has a shot —
// otherwise fall back to the first screen that does (a shot-less home would
// yield an empty cover even when usable screenshots exist).
function coverOf(view: View): string {
  const withShot = view.screens.filter((s) => s.screenshotPath)
  const screen = withShot.find((s) => s.role === "home") ?? withShot[0]
  return screen?.screenshotPath ?? ""
}
const registry: RegistryEntry[] = []
let viewCount = 0

// Sort by name so the registry order is slug order, independent of the host
// filesystem's readdir order (macOS APFS vs Linux CI) — index.json is committed.
for (const dir of readdirSync(capturesDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
  if (!dir.isDirectory()) continue
  const appDir = join(capturesDir, dir.name)
  const manifestPath = join(appDir, "app.json")
  if (!existsSync(manifestPath)) continue
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const dates: string[] = (manifest.captures ?? []).map((c: { date: string }) => c.date)

  let latestView: View | null = null
  for (const date of dates) {
    const graphPath = join(appDir, date, "graph.json")
    if (!existsSync(graphPath)) {
      console.warn(`skip ${dir.name}/${date}: no graph.json`)
      continue
    }
    const graph = JSON.parse(readFileSync(graphPath, "utf8")) as Graph
    const view = packageGraph(graph)
    writeFileSync(join(appDir, date, "view.json"), JSON.stringify(view))
    viewCount++
    if (view.stats.truncatedFlows > 0)
      console.warn(`⚠ ${dir.name}/${date}: ${view.stats.truncatedFlows} flow(s) hit the MAX_TRUNK cap (split into parent+child) — consider raising it or shortening the journey`)
    if (view.uncapturedSections.length > 0)
      console.warn(`⚠ ${dir.name}/${date}: main-nav section(s) with no captured journey: ${view.uncapturedSections.join(", ")} — walk past these tabs and re-capture`)

    // the registry summary comes from the latest view only
    if (date === manifest.latestCapture) {
      latestView = view
    }
  }

  // The app page (page.tsx readCapture) reads {latest}/view.json unconditionally, so a
  // registry entry whose latest produced no view would crash `next build` later with an
  // opaque ENOENT. Fail loudly here instead, naming the misconfiguration.
  if (!latestView) {
    throw new Error(
      `${dir.name}: latestCapture "${manifest.latestCapture}" has no view — ` +
        `no graph.json at that date, or it is not among captures ${JSON.stringify(dates)}. ` +
        `Fix ${dir.name}/app.json so latestCapture points at a captured date with a graph.json.`
    )
  }

  registry.push({
    slug: manifest.app.slug,
    name: manifest.app.name,
    platform: manifest.app.platform,
    captures: dates,
    latest: manifest.latestCapture,
    cover: coverOf(latestView),
    screens: latestView.screens.length,
    flows: latestView.flows.length,
    // A committed logo.png in the app folder overrides the generated avatar
    // everywhere (app UI + OG cards); null falls back to avatar.vercel.sh.
    logo: existsSync(join(appDir, "logo.png")) ? "logo.png" : null,
  })
}

writeFileSync(join(capturesDir, "index.json"), JSON.stringify({ apps: registry }, null, 2))
console.log(`built ${viewCount} view(s), ${registry.length} app(s)`)
