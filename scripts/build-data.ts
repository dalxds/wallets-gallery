// Data build (run before `next build` and on demand).
//
// For every app under public/captures, for every capture date with a graph.json,
// run the packager → write the derived view.json that the app fetches. Then emit
// the registry (index.json) and search index (search-index.json) from the views.
//
// graph.json is the single committed source; view.json + index.json +
// search-index.json are generated artifacts.

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { packageGraph } from "../lib/packager/index.ts"
import type { Graph, View } from "../lib/packager/types.ts"
import type { SearchEntry } from "../lib/types.ts"

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
}

// The browse page renders from index.json alone, so each entry needs a cover
// thumbnail. Prefer the home screen; fall back to the first screen.
function coverOf(view: View): string {
  const screen = view.screens.find((s) => s.role === "home") ?? view.screens[0]
  return screen ? screen.screenshotPath : ""
}
const registry: RegistryEntry[] = []
const searchEntries: SearchEntry[] = []
let viewCount = 0

for (const dir of readdirSync(capturesDir, { withFileTypes: true })) {
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

    // search entries + registry summary come from the latest view only
    if (date === manifest.latestCapture) {
      addSearchEntries(view)
      latestView = view
    }
  }

  registry.push({
    slug: manifest.app.slug,
    name: manifest.app.name,
    platform: manifest.app.platform,
    captures: dates,
    latest: manifest.latestCapture,
    cover: latestView ? coverOf(latestView) : "",
    screens: latestView?.screens.length ?? 0,
    flows: latestView?.flows.length ?? 0,
  })
}

function addSearchEntries(view: View) {
  const { slug, name } = view.app
  searchEntries.push({
    type: "app",
    appSlug: slug,
    appName: name,
    label: name,
    description: `${view.app.platform.toUpperCase()} app — ${view.screens.length} screens, ${view.flows.length} flows`,
    href: `/apps/${slug}`,
  })
  for (const s of view.screens) {
    searchEntries.push({
      type: "screen",
      appSlug: slug,
      appName: name,
      label: s.title || s.id,
      description: s.description,
      screenId: s.id,
      href: `/apps/${slug}?tab=screens&screen=${encodeURIComponent(s.id)}`,
    })
  }
  for (const f of view.flows) {
    searchEntries.push({
      type: "flow",
      appSlug: slug,
      appName: name,
      label: f.name,
      description: f.summary,
      flowSlug: f.slug,
      href: `/apps/${slug}?tab=flows&flow=${encodeURIComponent(f.slug)}`,
    })
    f.steps.forEach((step, i) => {
      searchEntries.push({
        type: "step",
        appSlug: slug,
        appName: name,
        label: step.title,
        description: step.description,
        flowSlug: f.slug,
        flowName: f.name,
        screenId: step.screenId,
        href: `/apps/${slug}?tab=flows&flow=${encodeURIComponent(f.slug)}&step=${i}`,
      })
    })
  }
}

writeFileSync(join(capturesDir, "index.json"), JSON.stringify({ apps: registry }, null, 2))
writeFileSync(join(capturesDir, "search-index.json"), JSON.stringify(searchEntries, null, 2))
console.log(`built ${viewCount} view(s), ${registry.length} app(s), ${searchEntries.length} search entries`)
