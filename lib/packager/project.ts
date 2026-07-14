// Canonical observed-graph projection shared by inventory, validation, migration,
// and the deterministic view builder. This layer makes no semantic decisions.

import type {
  DecisionPoint,
  FlowInventory,
  Graph,
  GraphEdge,
  GraphNode,
  Overrides,
} from "./types.ts"
import { classify, type ClassifyResult } from "./classify.ts"
import { screenTitle } from "./naming.ts"
import { runSAF, type SafResult } from "./saf.ts"

export interface ProjectedGraph {
  graph: Graph
  saf: SafResult
  classify: ClassifyResult
  overrides: Overrides
  canonicalOf: Map<string, string>
  nodes: GraphNode[]
  nodeById: Map<string, GraphNode>
  edges: GraphEdge[]
  decisionPoints: DecisionPoint[]
  root: string
  mainNav: string[]
  groupOf: Map<string, string>
  membersByGroup: Map<string, string[]>
}

function edgeOrder(a: GraphEdge, b: GraphEdge): number {
  if (a.from !== b.from) return a.from < b.from ? -1 : 1
  if (a.to !== b.to) return a.to < b.to ? -1 : 1
  if (a.observedAtStep !== b.observedAtStep) return a.observedAtStep - b.observedAtStep
  if (a.action !== b.action) return a.action < b.action ? -1 : 1
  if (a.selector === b.selector) return 0
  if (a.selector == null) return 1
  if (b.selector == null) return -1
  if (a.selector !== b.selector) return a.selector < b.selector ? -1 : 1
  if (a.kind !== b.kind)
    return a.kind === "in-place" ? -1 : b.kind === "in-place" ? 1 : a.kind < b.kind ? -1 : 1
  return 0
}

function betterEdge(a: GraphEdge, b: GraphEdge): GraphEdge {
  const byKind = (edge: GraphEdge) => (edge.kind === "in-place" ? 0 : 1)
  if (byKind(a) !== byKind(b)) return byKind(a) < byKind(b) ? a : b
  if (a.observedAtStep !== b.observedAtStep) return a.observedAtStep < b.observedAtStep ? a : b
  if (a.selector !== b.selector) {
    if (a.selector == null) return b
    if (b.selector == null) return a
    return a.selector < b.selector ? a : b
  }
  if (a.kind !== b.kind) return a.kind < b.kind ? a : b
  return a.action <= b.action ? a : b
}

export function projectGraph(graph: Graph): ProjectedGraph {
  const sourceOverrides = graph.overrides ?? {}
  const saf = runSAF(graph.nodes, sourceOverrides)
  const canonicalOf = saf.canonicalOf
  const canon = (id: string) => canonicalOf.get(id) ?? id

  const screenOverrides: NonNullable<Overrides["screens"]> = {}
  for (const id of Object.keys(sourceOverrides.screens ?? {}).sort()) {
    const canonical = canon(id)
    screenOverrides[canonical] = {
      ...screenOverrides[canonical],
      ...sourceOverrides.screens?.[id],
    }
  }
  const overrides: Overrides = { ...sourceOverrides, screens: screenOverrides }

  const byKey = new Map<string, GraphEdge>()
  for (const edge of graph.edges ?? []) {
    const from = canon(edge.from)
    const to = canon(edge.to)
    if (from === to) continue
    const remapped = { ...edge, from, to }
    const key = `${from}\u0000${to}\u0000${edge.action}`
    const previous = byKey.get(key)
    byKey.set(key, previous ? betterEdge(remapped, previous) : remapped)
  }
  const edges = [...byKey.values()].sort(edgeOrder)
  const nodes = [...saf.canonicalNodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const classification = classify({ ...saf, canonicalNodes: nodes }, edges, overrides)

  const groupOf = new Map<string, string>()
  const membersByGroup = new Map<string, string[]>()
  for (const node of nodes) {
    const group = classification.stateGroup.get(node.id) ?? node.id
    groupOf.set(node.id, group)
    const members = membersByGroup.get(group) ?? []
    members.push(node.id)
    membersByGroup.set(group, members)
  }
  for (const members of membersByGroup.values()) members.sort(derivationOrder(classification))

  const decisionPoints = (graph.decisionPoints ?? [])
    .map((point) => ({
      nodeId: canon(point.nodeId),
      options: point.options.map((option) => ({
        ...option,
        ...(option.toNode != null ? { toNode: canon(option.toNode) } : {}),
      })),
    }))
    .sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0))

  return {
    graph,
    saf,
    classify: classification,
    overrides,
    canonicalOf,
    nodes,
    nodeById,
    edges,
    decisionPoints,
    root: canon(graph.root),
    mainNav: [...new Set((graph.mainNav ?? []).map(canon))],
    groupOf,
    membersByGroup,
  }
}

function labelOrder(value: string): number {
  const known: Record<string, number> = { default: 0, empty: 1, loading: 2, max: 3, error: 4 }
  if (known[value] != null) return known[value]
  if (/^\d+$/.test(value)) return 100 + Number(value)
  return 9
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function derivationLabel(value: string): string {
  if (value === "default") return "Default"
  if (value === "empty") return "Empty"
  if (value === "loading") return "Loading"
  if (value === "max") return "Max"
  if (value === "error") return "Error"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function derivationOrder(classification: ClassifyResult) {
  return (a: string, b: string): number => {
    const aState = classification.state.get(a) ?? "default"
    const bState = classification.state.get(b) ?? "default"
    const order = labelOrder(aState) - labelOrder(bState)
    if (order) return order
    const label = compareCodePoints(derivationLabel(aState), derivationLabel(bState))
    return label || compareCodePoints(a, b)
  }
}

export function buildInventory(graph: Graph): FlowInventory {
  const projected = projectGraph(graph)
  const screens = projected.nodes.map((node) => {
    const group = projected.classify.stateGroup.get(node.id)
    const state = group ? projected.classify.state.get(node.id) ?? "default" : undefined
    return {
      id: node.id,
      title: screenTitle(node, projected.overrides),
      role: projected.overrides.screens?.[node.id]?.role ?? node.role,
      texts: [...node.texts],
      primaryCTA:
        node.interactiveElements.find((element) => element.emphasis === "primary")?.label ?? null,
      screenshotPath: node.screenshotPath,
      snapshotPath: node.snapshotPath,
      ...(state ? { state, stateGroup: group, derivationLabel: derivationLabel(state) } : {}),
    }
  })
  const derivationGroups = [...projected.membersByGroup]
    .filter(([, members]) => members.length > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, members]) => ({
      id,
      members: members.map((member) => ({
        id: member,
        label: derivationLabel(projected.classify.state.get(member) ?? "default"),
      })),
    }))
  const canonicalizations = [...projected.canonicalOf]
    .filter(([from, to]) => from !== to)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([from, to]) => ({ from, to }))
  return {
    schemaVersion: 1,
    app: graph.meta.app,
    captureDate: graph.meta.captureDate,
    root: projected.root,
    mainNav: projected.mainNav,
    screens,
    derivationGroups,
    edges: projected.edges,
    decisionPoints: projected.decisionPoints,
    canonicalizations,
  }
}

export function edgeBetween(projected: ProjectedGraph, from: string, to: string): GraphEdge | null {
  let best: GraphEdge | null = null
  for (const edge of projected.edges) {
    if (edge.from !== from || edge.to !== to) continue
    if (!best || edgeOrder(edge, best) < 0) best = edge
  }
  return best
}
