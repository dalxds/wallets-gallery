// Validate a graph.json (the source of truth) before packaging. Replaces the
// legacy standalone validate-capture.mjs — the contract is now the graph, and the
// view is derived, so there is nothing to validate downstream of package().

import type { Graph } from "./types.ts"

const EDGE_KINDS = new Set(["nav", "overlay", "in-place", "back"])

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

export function validateGraph(graph: Graph): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  if (graph?.meta?.schemaVersion !== 2) err(`meta.schemaVersion must be 2, got ${graph?.meta?.schemaVersion}`)
  if (!Array.isArray(graph?.nodes) || graph.nodes.length === 0) {
    err("nodes must be a non-empty array")
    return { errors, warnings }
  }

  const ids = new Set<string>()
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i]
    const ctx = `nodes[${i}] (${n.id ?? "?"})`
    if (!n.id) err(`${ctx}: missing id`)
    else if (ids.has(n.id)) err(`${ctx}: duplicate id`)
    else ids.add(n.id)
    if (!n.fingerprint || !/^sha256(-text)?:/.test(n.fingerprint)) err(`${ctx}: invalid fingerprint`)
    if (!n.screenshotPath) warn(`${ctx}: no screenshotPath`)
    for (const e of n.interactiveElements ?? []) {
      if (e.selector === "") err(`${ctx}: empty-string selector — use null`)
    }
  }

  if (!ids.has(graph.root)) err(`root "${graph.root}" not in nodes`)

  for (let i = 0; i < (graph.edges ?? []).length; i++) {
    const e = graph.edges[i]
    const ctx = `edges[${i}] (${e.from}→${e.to})`
    if (!ids.has(e.from)) err(`${ctx}: from not in nodes`)
    if (!ids.has(e.to)) err(`${ctx}: to not in nodes`)
    if (!EDGE_KINDS.has(e.kind)) err(`${ctx}: invalid kind "${e.kind}"`)
    if (e.selector === "") err(`${ctx}: empty-string selector — use null`)
  }

  for (const dp of graph.decisionPoints ?? []) {
    if (!ids.has(dp.nodeId)) err(`decisionPoint nodeId "${dp.nodeId}" not in nodes`)
    for (const o of dp.options ?? []) {
      if (o.toNode != null && !ids.has(o.toNode)) err(`decisionPoint option toNode "${o.toNode}" not in nodes`)
    }
  }

  const ov = graph.overrides ?? {}
  const refs: [string, string[]][] = [
    ["overrides.screens", Object.keys(ov.screens ?? {})],
    ["overrides.flowNames", Object.keys(ov.flowNames ?? {})],
    ["overrides.structure", Object.keys(ov.structure ?? {})],
    ["overrides.splits", ov.splits ?? []],
    ["overrides.merges", (ov.merges ?? []).flat()],
  ]
  for (const [label, keys] of refs) {
    for (const k of keys) if (!ids.has(k)) warn(`${label}: "${k}" is not a node id`)
  }

  return { errors, warnings }
}
