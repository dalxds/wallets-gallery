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

/** Forward-reachable set from `start` (excludes start unless it cycles back). */
export function reachableFrom(adj: Adjacency, start: string, options: { exclude?: Set<string> } = {}): Set<string> {
  const seen = new Set<string>()
  const exclude = options.exclude ?? new Set<string>()
  const queue = [start]
  const visited = new Set<string>([start])
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of adj.out.get(cur) ?? []) {
      if (exclude.has(e.to)) continue
      if (!seen.has(e.to)) seen.add(e.to)
      if (!visited.has(e.to)) {
        visited.add(e.to)
        queue.push(e.to)
      }
    }
  }
  return seen
}
