// Small directed-graph helpers over the (canonicalized) edge list.
import type { GraphEdge } from "./types.ts"

export interface Adjacency {
  out: Map<string, GraphEdge[]>
  in: Map<string, GraphEdge[]>
  nodes: Set<string>
}

export function buildAdjacency(nodeIds: Iterable<string>, edges: GraphEdge[]): Adjacency {
  const out = new Map<string, GraphEdge[]>()
  const inn = new Map<string, GraphEdge[]>()
  const nodes = new Set<string>(nodeIds)
  for (const id of nodes) {
    out.set(id, [])
    inn.set(id, [])
  }
  for (const e of edges) {
    if (!nodes.has(e.from) || !nodes.has(e.to) || e.from === e.to) continue
    out.get(e.from)!.push(e)
    inn.get(e.to)!.push(e)
  }
  return { out, in: inn, nodes }
}
