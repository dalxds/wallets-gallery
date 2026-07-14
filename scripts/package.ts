// Strict graph + semantic-flow package builder used by the capture workflow.
//
//   node scripts/package.ts <graph.json> [flows.json] [--json]

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { packageGraph } from "../lib/packager/index.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import { validateFlows } from "../lib/packager/flows.ts"
import type { FlowsFile, Graph } from "../lib/packager/types.ts"

const graphPath = process.argv[2]
const explicitFlowsPath = process.argv.slice(3).find((arg) => !arg.startsWith("--"))
const asJson = process.argv.includes("--json")
if (!graphPath) {
  console.error("usage: node scripts/package.ts <graph.json> [flows.json] [--json]")
  process.exit(2)
}
const flowsPath = explicitFlowsPath ?? join(dirname(graphPath), "flows.json")
const graph = JSON.parse(readFileSync(graphPath, "utf8")) as Graph
const flows = JSON.parse(readFileSync(flowsPath, "utf8")) as FlowsFile

const graphValidation = validateGraph(graph)
const flowValidation = validateFlows(graph, flows, { strict: true })
for (const warning of [...graphValidation.warnings, ...flowValidation.warnings])
  console.error(`warn:  ${warning}`)
const errors = [...graphValidation.errors, ...flowValidation.errors]
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`)
  console.error(`\nFAILED: ${errors.length} error(s)`)
  process.exit(1)
}

const view = packageGraph(graph, flows)
if (asJson) {
  process.stdout.write(JSON.stringify(view, null, 2))
  process.exit(0)
}

console.log(`${view.app.name} — ${view.captureDate}`)
console.log(JSON.stringify(view.stats, null, 2))
const children = new Map<string | null, typeof view.flows>()
for (const flow of view.flows) {
  const siblings = children.get(flow.parent) ?? []
  siblings.push(flow)
  children.set(flow.parent, siblings)
}
const printTree = (parent: string | null, depth: number) => {
  for (const flow of children.get(parent) ?? []) {
    const replay =
      flow.replay.status === "available"
        ? flow.replay.confidence
        : `unavailable: ${flow.replay.reason}`
    console.log(
      `${"  ".repeat(depth)}• ${flow.name} [${flow.id}] (${flow.steps.length} rendered, replay=${replay})`
    )
    printTree(flow.id, depth + 1)
  }
}
console.log("\nflow tree:")
printTree(null, 0)
if (view.diagnostics.length) {
  console.log("\ndiagnostics:")
  for (const diagnostic of view.diagnostics)
    console.log(`  ${diagnostic.code}: ${diagnostic.message}`)
}
