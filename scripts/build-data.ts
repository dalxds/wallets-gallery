// Data build (run before `next build` and on demand).
//
// For every dated graph.json + flows.json pair, build the derived view.json.
//
// graph.json and flows.json are committed sources; view.json + index.json are generated.

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { packageGraph } from "../lib/packager/index.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import { validateFlows } from "../lib/packager/flows.ts"
import type { FlowsFile, Graph, View } from "../lib/packager/types.ts"
// Type the registry against the reader's contract so generator and consumer can't
// drift: add a field to AppIndex and this script stops compiling until it emits it.
import type { AppIndex } from "../lib/types.ts"

const capturesDir = join(process.cwd(), "public/captures")

// The browse page renders from index.json alone, so each entry needs a cover
// thumbnail. Prefer the home screen, but only one that actually has a shot —
// otherwise fall back to the first screen that does (a shot-less home would
// yield an empty cover even when usable screenshots exist).
function coverOf(view: View): string {
  const withShot = view.screens.filter((s) => s.screenshotPath)
  const screen = withShot.find((s) => s.role === "home") ?? withShot[0]
  return screen?.screenshotPath ?? ""
}
// A committed logo.png overrides the generated avatar everywhere (app UI + OG cards); null falls
// back to avatar.vercel.sh. Content-version the fixed name with a short hash: screenshots are
// content-addressed so a change moves their URL, but logo.png is a fixed name — og.tsx fetches it
// force-cached into Vercel's cross-deploy Data Cache (keyed by URL), so a replaced logo would
// otherwise composite the OLD bytes onto every new OG card forever. The `?v=<hash>` moves the URL
// exactly when the bytes change, busting that cache; static serving ignores the query. Pure hash → deterministic.
function logoRef(appDir: string): string | null {
  const p = join(appDir, "logo.png")
  if (!existsSync(p)) return null
  return `logo.png?v=${createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12)}`
}
const registry: AppIndex[] = []
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
  const builtDates: string[] = [] // dates that actually produced a view.json
  for (const date of dates) {
    const graphPath = join(appDir, date, "graph.json")
    const flowsPath = join(appDir, date, "flows.json")
    if (!existsSync(graphPath)) {
      console.warn(`skip ${dir.name}/${date}: no graph.json`)
      continue
    }
    if (!existsSync(flowsPath))
      throw new Error(`${dir.name}/${date}: missing flows.json beside graph.json`)
    const graph = JSON.parse(readFileSync(graphPath, "utf8")) as Graph
    const flowSource = JSON.parse(readFileSync(flowsPath, "utf8")) as FlowsFile
    // Validate before packaging — same contract as scripts/package.ts. Invalid graphs
    // (bad edge endpoint, duplicate id, …) would otherwise package into a silently
    // corrupt view and deploy. Fail the build loudly instead; warn on soft issues.
    const { errors, warnings } = validateGraph(graph)
    for (const w of warnings) console.warn(`⚠ ${dir.name}/${date}: ${w}`)
    if (errors.length)
      throw new Error(`${dir.name}/${date}: invalid graph.json —\n  ${errors.join("\n  ")}`)
    const flowValidation = validateFlows(graph, flowSource, { strict: true })
    for (const w of flowValidation.warnings) console.warn(`⚠ ${dir.name}/${date}: ${w}`)
    if (flowValidation.errors.length)
      throw new Error(`${dir.name}/${date}: invalid flows.json —\n  ${flowValidation.errors.join("\n  ")}`)
    const view = packageGraph(graph, flowSource)
    writeFileSync(join(appDir, date, "view.json"), JSON.stringify(view))
    builtDates.push(date)
    viewCount++
    for (const diagnostic of view.diagnostics)
      if (diagnostic.code === "replay-unavailable")
        console.warn(`⚠ ${dir.name}/${date}: ${diagnostic.flowId}: ${diagnostic.message}`)

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
    captures: builtDates, // only dates with a view.json — skipped dates would 404 from the picker
    latest: manifest.latestCapture,
    cover: coverOf(latestView),
    screens: latestView.screens.length,
    flows: latestView.flows.length,
    logo: logoRef(appDir), // "logo.png?v=<content-hash>" or null — see logoRef
  })
}

writeFileSync(join(capturesDir, "index.json"), JSON.stringify({ apps: registry }, null, 2))
console.log(`built ${viewCount} view(s), ${registry.length} app(s)`)
