// Inventory, draft validation, all-capture audit, and mechanical flow-reference migration.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { auditFlowPackages, migrateFlows, validateFlows } from "../lib/packager/flows.ts"
import { buildInventory } from "../lib/packager/project.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import type { AuditedFlowPackage } from "../lib/packager/flows.ts"
import type { FlowsFile, Graph } from "../lib/packager/types.ts"

const command = process.argv[2]
const capturesDir = join(process.cwd(), "public/captures")

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function allPackages(): (AuditedFlowPackage & { flowsPath: string; app: string; date: string })[] {
  const packages: (AuditedFlowPackage & { flowsPath: string; app: string; date: string })[] = []
  for (const appEntry of readdirSync(capturesDir, { withFileTypes: true }).sort((a, b) => compareCodePoints(a.name, b.name))) {
    if (!appEntry.isDirectory()) continue
    const appDir = join(capturesDir, appEntry.name)
    const manifestPath = join(appDir, "app.json")
    if (!existsSync(manifestPath)) continue
    const manifest = readJson<{ captures?: { date: string }[] }>(manifestPath)
    for (const capture of [...(manifest.captures ?? [])].sort((a, b) => compareCodePoints(a.date, b.date))) {
      const graphPath = join(appDir, capture.date, "graph.json")
      const flowsPath = join(appDir, capture.date, "flows.json")
      if (!existsSync(graphPath)) continue
      if (!existsSync(flowsPath))
        throw new Error(`${appEntry.name}/${capture.date}: missing flows.json beside graph.json`)
      packages.push({
        key: `${appEntry.name}/${capture.date}`,
        app: appEntry.name,
        date: capture.date,
        graph: readJson<Graph>(graphPath),
        flows: readJson<FlowsFile>(flowsPath),
        flowsPath,
      })
    }
  }
  return packages
}

if (command === "inventory") {
  const graphPath = process.argv[3]
  if (!graphPath) {
    console.error("usage: node scripts/flows.ts inventory <graph.json>")
    process.exit(2)
  }
  const graph = readJson<Graph>(graphPath)
  const validation = validateGraph(graph)
  if (validation.errors.length) {
    for (const error of validation.errors) console.error(`error: ${error}`)
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(buildInventory(graph), null, 2) + "\n")
} else if (command === "validate") {
  const graphPath = process.argv[3]
  const explicitFlowsPath = process.argv.slice(4).find((argument) => !argument.startsWith("--"))
  const flowsPath = explicitFlowsPath ?? (graphPath ? join(dirname(graphPath), "flows.json") : null)
  if (!graphPath || !flowsPath) {
    console.error("usage: node scripts/flows.ts validate <graph.json> [flows.json] [--strict]")
    process.exit(2)
  }
  const graph = readJson<Graph>(graphPath)
  const result = validateFlows(graph, readJson<FlowsFile>(flowsPath), {
    strict: process.argv.includes("--strict"),
  })
  for (const warning of result.warnings) console.log(`warn:  ${warning}`)
  for (const error of result.errors) console.log(`error: ${error}`)
  console.log(JSON.stringify(result.coverage, null, 2))
  if (result.errors.length) process.exit(1)
} else if (command === "audit" && process.argv.includes("--all")) {
  const packages = allPackages()
  const report = auditFlowPackages(packages)
  const byApp = new Map<string, typeof packages>()
  for (const item of packages) {
    const history = byApp.get(item.app) ?? []
    history.push(item)
    byApp.set(item.app, history)
  }
  for (const history of byApp.values()) {
    const seen = new Set<string>()
    let previous = new Set<string>()
    history.sort((a, b) => compareCodePoints(a.date, b.date))
    for (const item of history) {
      const current = new Set(item.flows.flows.map((flow) => flow.id))
      const revived = [...current].filter((id) => seen.has(id) && !previous.has(id)).sort()
      if (revived.length) {
        const packageReport = report.packages.find((entry) => entry.key === item.key)!
        packageReport.warnings.push(
          ...revived.map((id) => `flow "${id}" returns after an absent capture; confirm same intent`)
        )
        packageReport.warnings.sort()
        report.totals.warnings += revived.length
      }
      for (const id of current) seen.add(id)
      previous = current
    }
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n")
  if (report.totals.errors) process.exit(1)
} else if (command === "migrate" && process.argv.includes("--all")) {
  const write = process.argv.includes("--write")
  const candidates = allPackages().map((item) => {
    const migrated = migrateFlows(item.graph, item.flows)
    const changed = JSON.stringify(item.flows) !== JSON.stringify(migrated.flows)
    const after = JSON.stringify(migrated.flows, null, 2) + "\n"
    if (write && changed) writeFileSync(item.flowsPath, after)
    return {
      key: item.key,
      path: item.flowsPath,
      changed,
      canonicalizations: migrated.canonicalizations,
      warnings: migrated.warnings,
      ...(changed ? { proposed: migrated.flows } : {}),
    }
  })
  process.stdout.write(JSON.stringify({ write, candidates }, null, 2) + "\n")
} else {
  console.error("usage: node scripts/flows.ts <inventory|validate|audit|migrate> ...")
  process.exit(2)
}
