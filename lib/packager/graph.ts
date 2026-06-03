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

export function indegree(adj: Adjacency, id: string): number {
  return adj.in.get(id)?.length ?? 0
}

export function outNeighbors(adj: Adjacency, id: string): string[] {
  return (adj.out.get(id) ?? []).map((e) => e.to)
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

/** Unweighted shortest path (BFS) from→to inclusive, or null. Deterministic: edges
 *  are explored in input order, ties broken by first discovery. */
export function shortestPath(adj: Adjacency, from: string, to: string): string[] | null {
  if (from === to) return [from]
  const prev = new Map<string, string>()
  const visited = new Set<string>([from])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of adj.out.get(cur) ?? []) {
      if (visited.has(e.to)) continue
      visited.add(e.to)
      prev.set(e.to, cur)
      if (e.to === to) {
        const path = [to]
        let p = cur
        while (p !== from) {
          path.push(p)
          p = prev.get(p)!
        }
        path.push(from)
        return path.reverse()
      }
      queue.push(e.to)
    }
  }
  return null
}

/** BFS distance from root to every reachable node. */
export function distancesFrom(adj: Adjacency, root: string): Map<string, number> {
  const dist = new Map<string, number>([[root, 0]])
  const queue = [root]
  while (queue.length) {
    const cur = queue.shift()!
    const d = dist.get(cur)!
    for (const e of adj.out.get(cur) ?? []) {
      if (!dist.has(e.to)) {
        dist.set(e.to, d + 1)
        queue.push(e.to)
      }
    }
  }
  return dist
}
