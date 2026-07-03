// CLI wrapper around the packager, for the capture skill.
//
//   node scripts/package.ts <graph.json>            # summary + namingTODO
//   node scripts/package.ts <graph.json> --json     # full derived View to stdout
//
// The SSG build imports packageGraph() directly; this is the skill's entry point
// for inspecting flows, collecting names to fill into overrides, and validating.

import { readFileSync } from "node:fs"
import { packageGraph } from "../lib/packager/index.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import type { Graph } from "../lib/packager/types.ts"

const path = process.argv[2]
const asJson = process.argv.includes("--json")
if (!path) {
  console.error("usage: node scripts/package.ts <graph.json> [--json]")
  process.exit(2)
}

const graph = JSON.parse(readFileSync(path, "utf8")) as Graph
const { errors, warnings } = validateGraph(graph)
for (const w of warnings) console.error(`warn:  ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`)
  console.error(`\nFAILED: ${errors.length} error(s) in ${path}`)
  process.exit(1)
}
const view = packageGraph(graph)

if (asJson) {
  process.stdout.write(JSON.stringify(view, null, 2))
  process.exit(0)
}

console.log(`${view.app.name} — ${view.captureDate}`)
console.log(JSON.stringify(view.stats, null, 2))

const childrenOf = new Map<string | null, typeof view.flows>()
for (const f of view.flows) (childrenOf.get(f.parent) ?? childrenOf.set(f.parent, []).get(f.parent)!).push(f)
const printFlow = (slug: string | null, depth: number) => {
  for (const f of childrenOf.get(slug) ?? []) {
    console.log("  ".repeat(depth) + `• ${f.name} [${f.slug}] (${f.steps.length} steps, replay=${f.replay?.confidence ?? "none"})`)
    printFlow(f.slug, depth + 1)
  }
}
console.log("\nflow tree:")
printFlow(null, 0)

if (view.namingTODO.length) {
  console.log(`\nnamingTODO (${view.namingTODO.length}) — fill via overrides.flowNames, keyed by nameKey:`)
  for (const t of view.namingTODO) console.log(`  ${t.nameKey} → "${t.mechanicalName}"  (flow: ${t.slug})`)
}
