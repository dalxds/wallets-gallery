// Seed / refresh flow-slug pins (graph.metadata.flowSlugs) — the persistence half
// of stable deep links.
//
//   node scripts/sync-slugs.ts                 # all apps, dry-run (report only)
//   node scripts/sync-slugs.ts --write         # all apps, persist pins
//   node scripts/sync-slugs.ts <graph.json>    # one capture
//   node scripts/sync-slugs.ts <graph.json> --write
//
// What it does: package each graph.json, then pin every flow id that is NOT already
// pinned to the slug this build gave it. Existing pins are never overwritten —
// that is the whole point: once a flow's URL is fixed it stays fixed, so a later
// rename or re-derivation can't move it. Run after a capture/edit; commit the
// graph.json changes. metadata is carried forward into the next capture (like
// overrides), so the pins keep flows' URLs stable across re-captures too.
//
// This does NOT invent flowAliases. Aliases are for the rarer case where a flow's
// anchor-node id itself changes between captures (so the pin no longer matches);
// record those by hand in metadata.flowAliases, or extend this script with an
// identity match once that pattern shows up.

import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { packageGraph } from "../lib/packager/index.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import type { Graph } from "../lib/packager/types.ts"

const capturesDir = join(process.cwd(), "public/captures")
const args = process.argv.slice(2)
const write = args.includes("--write")
const explicit = args.find((a) => !a.startsWith("--"))

// Collect the graph.json paths to process: one if given, else every capture.
function allGraphs(): string[] {
  const out: string[] = []
  for (const dir of readdirSync(capturesDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const appDir = join(capturesDir, dir.name)
    const manifestPath = join(appDir, "app.json")
    if (!existsSync(manifestPath)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    for (const c of manifest.captures ?? []) {
      const p = join(appDir, c.date, "graph.json")
      if (existsSync(p)) out.push(p)
    }
  }
  return out
}

const paths = explicit ? [explicit] : allGraphs()
let changed = 0

for (const path of paths) {
  const graph = JSON.parse(readFileSync(path, "utf8")) as Graph
  const { errors } = validateGraph(graph)
  if (errors.length) {
    console.error(`skip ${path}: ${errors.length} validation error(s)`)
    continue
  }

  const view = packageGraph(graph)
  const existing = graph.metadata?.flowSlugs ?? {}
  const added: [string, string][] = []
  const pins: Record<string, string> = { ...existing }
  for (const [flowId, slug] of Object.entries(view.flowSlugs)) {
    if (!(flowId in pins)) {
      pins[flowId] = slug
      added.push([flowId, slug])
    }
  }

  if (!added.length) continue
  changed++
  console.log(`${path}: +${added.length} pin(s)`)
  for (const [flowId, slug] of added) console.log(`  ${flowId} → ${slug}`)

  if (write) {
    graph.metadata = { ...graph.metadata, flowSlugs: pins }
    writeFileSync(path, JSON.stringify(graph, null, 2) + "\n")
  }
}

if (!changed) console.log("all flow slugs already pinned — nothing to do")
else if (!write) console.log(`\n${changed} capture(s) would change — re-run with --write to persist`)
else console.log(`\npinned ${changed} capture(s)`)
