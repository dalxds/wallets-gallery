// Migration + validation: build a schema-2 graph.json from a legacy capture.json,
// then run the packager and report. Legacy flows persisted entry points but not the
// navigation edges into them, so we reconstruct connective edges (parent→child,
// home→top-level) from the legacy tree. Human-authored bits (titles, descriptions,
// state tags) are carried into overrides — the migration path for the new model.
//
// Usage: node scripts/reconstruct.ts [captureDir] [captureDate]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { skeletonFromElements, skeletonFromTexts } from "../lib/packager/identity.ts"
import { packageGraph } from "../lib/packager/index.ts"
import { pHashFromPng } from "./phash.ts"
import type { Graph, GraphEdge, GraphNode, ScreenRole } from "../lib/packager/types.ts"

const dir = process.argv[2] ?? "public/captures/base"
const date = process.argv[3] ?? "2026-05-26"
const cap = JSON.parse(readFileSync(`${dir}/${date}/capture.json`, "utf8"))
const app = JSON.parse(readFileSync(`${dir}/app.json`, "utf8")).app

const ROOT = "home-funded"

// ── Nodes ──────────────────────────────────────────────────────────────────
const nodes: GraphNode[] = cap.screens.map((s: any): GraphNode => {
  const elements = s.interactiveElements ?? []
  const skeletonHash = elements.length
    ? skeletonFromElements(s.role, elements)
    : skeletonFromTexts(s.role, s.texts ?? [])
  return {
    id: s.id,
    fingerprint: s.fingerprint,
    skeletonHash,
    pHash: s.screenshotPath ? pHashFromPng(join(dir, s.screenshotPath)) : null,
    routeKey: null,
    role: s.role as ScreenRole,
    screenshotPath: s.screenshotPath,
    snapshotPath: s.snapshotPath ?? null,
    texts: s.texts ?? [],
    interactiveElements: elements,
    primaryCta: s.primaryCta ?? null,
    secondaryCtas: s.secondaryCtas ?? [],
  }
})
const nodeIds = new Set(nodes.map((n) => n.id))
const skById = new Map(nodes.map((n) => [n.id, n.skeletonHash]))
const roleById = new Map(cap.screens.map((s: any) => [s.id, s.role]))

// ── Edges ──────────────────────────────────────────────────────────────────
const edges: GraphEdge[] = []
const edgeSeen = new Set<string>()
let step = 0
function addEdge(from: string, to: string, action: string, selector: string | null) {
  if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return
  const key = `${from}->${to}`
  if (edgeSeen.has(key)) return
  edgeSeen.add(key)
  const sameSk = !!skById.get(from) && skById.get(from) === skById.get(to)
  const kind: GraphEdge["kind"] = sameSk ? "in-place" : roleById.get(to) === "modal" ? "overlay" : "nav"
  edges.push({ from, to, action: action || "Navigate", selector: selector ?? null, kind, observedAtStep: ++step })
}

// intra-flow step edges
for (const f of cap.flows) {
  const st = f.steps ?? []
  for (let i = 1; i < st.length; i++) addEdge(st[i - 1].screenId, st[i].screenId, st[i].action, st[i].selector)
}
// Journey paths come from the legacy flows' own step-sequences (above) — NOT from
// synthetic star edges. The legacy step chains (and the branches between them) are
// the real journeys; decision points add the remaining observed branches.
const entryOf = new Map<string, string>(cap.flows.map((f: any) => [f.slug, (f.entryPoints ?? [])[0]]))
// decision-point branch edges
const decisionPoints = (cap.decisionPoints ?? []).map((dp: any) => ({
  nodeId: dp.screenId,
  options: dp.options.map((o: any) => {
    const to = o.flowSlug ? entryOf.get(o.flowSlug) : null
    if (to) addEdge(dp.screenId, to, `Tap ${o.label}`, null)
    return { label: o.label, explored: !!o.explored, toNode: to ?? null }
  }),
}))

// ── Overrides: carry legacy human knowledge ──────────────────────────────────
const screensOv: Record<string, any> = {}
for (const s of cap.screens) {
  const o: any = {}
  if (s.title) o.title = s.title
  if (s.description) o.description = s.description
  if (s.state) o.state = s.state
  if (s.stateGroup) o.stateGroup = s.stateGroup
  if (Object.keys(o).length) screensOv[s.id] = o
}

const graph: Graph = {
  meta: {
    schemaVersion: 2,
    app,
    captureDate: cap.captureDate,
    scope: cap.scope,
    mode: cap.mode,
    previousCapture: cap.previousCapture ?? null,
  },
  root: ROOT,
  nodes,
  edges,
  decisionPoints,
  overrides: { screens: screensOv },
}
writeFileSync(`${dir}/${date}/graph.json`, JSON.stringify(graph, null, 2))

// ── Run the packager + report ────────────────────────────────────────────────
const view = packageGraph(graph)
const view2 = packageGraph(JSON.parse(JSON.stringify(graph)))
const deterministic = JSON.stringify(view) === JSON.stringify(view2)

console.log(`\n=== graph.json ===`)
console.log(`${nodes.length} nodes · ${edges.length} edges · ${decisionPoints.length} decision points · root=${ROOT}`)
console.log(`\n=== derived view ===`)
console.log(JSON.stringify(view.stats, null, 2))
console.log(`deterministic: ${deterministic}`)

console.log(`\n=== MERGE check (requires-usdc) ===`)
const ids = new Set(view.screens.map((s) => s.id))
console.log(`trading-requires-usdc present: ${ids.has("trading-requires-usdc")}`)
console.log(`trade-requires-usdc present:   ${ids.has("trade-requires-usdc")}`)

console.log(`\n=== state groups derived ===`)
const groups = new Map<string, string[]>()
for (const s of view.screens) if (s.stateGroup) (groups.get(s.stateGroup) ?? groups.set(s.stateGroup, []).get(s.stateGroup)!).push(`${s.id}:${s.state}`)
for (const [g, m] of groups) console.log(`  ${g}: ${m.join(", ")}`)

console.log(`\n=== flow tree (top 2 levels) ===`)
const childrenOf = new Map<string | null, any[]>()
for (const f of view.flows) (childrenOf.get(f.parent) ?? childrenOf.set(f.parent, []).get(f.parent)!).push(f)
for (const top of childrenOf.get(null) ?? []) {
  console.log(`• ${top.name}  [${top.slug}]  (${top.steps.length} steps, replay=${top.replay ? top.replay.confidence : "none"})`)
  for (const c of childrenOf.get(top.slug) ?? []) console.log(`    └ ${c.name}  [${c.slug}]  entry=${c.entryPoints[0]}`)
}

console.log(`\n=== entry-containment violations ===`)
const flowBySlug = new Map(view.flows.map((f) => [f.slug, f]))
let violations = 0
for (const f of view.flows) {
  if (!f.parent) continue
  const p = flowBySlug.get(f.parent)
  if (!p || !p.steps.some((s) => s.screenId === f.entryPoints[0])) {
    violations++
    if (violations <= 10) console.log(`  ✗ ${f.slug} entry=${f.entryPoints[0]} not in parent ${f.parent}`)
  }
}
console.log(`total violations: ${violations} / ${view.flows.filter((f) => f.parent).length} child flows`)
