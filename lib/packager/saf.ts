// Screen Abstraction Function: collapse raw observed nodes into logical screens.
//
// Two distinct operations, in order:
//   1. MERGE   — nodes that are the SAME screen state, differing only in dynamic
//                data (a list of N vs N+1 rows; "…purchase of VIRTUAL" vs "…ETH").
//                Collapsed to one canonical node. Signal: equal skeleton + equal
//                dynamic-normalized text, OR equal skeleton + near-identical pHash.
//   2. CLUSTER — canonical nodes that are the SAME logical screen but a genuinely
//                DIFFERENT state (home empty vs funded, trade vs trade-max).
//                Kept as distinct nodes, grouped into a family. Signal: equal
//                skeleton, or pHash within the (looser) cluster band.
//
// Pure / signal-driven — no image work here (pHash is precomputed onto nodes).

import type { GraphNode, Overrides } from "./types.ts"
import { normalizeDynamic, pHashDistance } from "./identity.ts"

// Same screen, data-only difference: near-identical pixels. Deliberately tight — this
// pHash tolerance is the ONLY guard against a false merge once two nodes share a skeleton,
// and the element-multiset skeleton is itself coarse (many unrelated screens collide on it,
// see identity.ts). 6/64 bits absorbs render/encoding jitter between two captures of one
// state while still rejecting genuinely different screens (the closest distinct
// same-skeleton pair on tuyo is 8 apart). A tree-based skeleton could safely loosen this.
export const T_MERGE_PHASH = 6

export interface SafResult {
  /** raw node id → canonical (post-merge) node id */
  canonicalOf: Map<string, string>
  /** canonical node id → logical screen id */
  logicalOf: Map<string, string>
  /** logical screen id → member canonical node ids (representative first) */
  members: Map<string, string[]>
  /** the canonical nodes (one per merge class), in input order */
  canonicalNodes: GraphNode[]
}

class UnionFind {
  private parent = new Map<string, string>()
  add(x: string) {
    if (!this.parent.has(x)) this.parent.set(x, x)
  }
  find(x: string): string {
    let r = x
    while (this.parent.get(r) !== r) r = this.parent.get(r)!
    // path-compress
    while (this.parent.get(x) !== r) {
      const next = this.parent.get(x)!
      this.parent.set(x, r)
      x = next
    }
    return r
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

const mergeKey = (n: GraphNode) =>
  n.skeletonHash + "##" + normalizeDynamic(n.texts.join(" • "))

// Richer node wins as representative: most interactive elements, then most texts,
// then lexically-smallest id (deterministic).
function pickRepresentative(nodes: GraphNode[]): GraphNode {
  return [...nodes].sort((a, b) => {
    const e = b.interactiveElements.length - a.interactiveElements.length
    if (e) return e
    const t = b.texts.length - a.texts.length
    if (t) return t
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
}

export function runSAF(nodes: GraphNode[], overrides: Overrides = {}): SafResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const splits = new Set(overrides.splits ?? [])

  // ── 1. MERGE ────────────────────────────────────────────────────────────
  const uf = new UnionFind()
  for (const n of nodes) uf.add(n.id)

  const byMergeKey = new Map<string, GraphNode[]>()
  for (const n of nodes) {
    const k = mergeKey(n)
    const arr = byMergeKey.get(k)
    if (arr) arr.push(n)
    else byMergeKey.set(k, [n])
  }
  for (const group of byMergeKey.values()) {
    for (let i = 1; i < group.length; i++) {
      if (splits.has(group[i].id) || splits.has(group[0].id)) continue
      uf.union(group[0].id, group[i].id)
    }
  }
  // tight-pHash merges (identical layout even when normalized text drifts)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]
      const b = nodes[j]
      if (splits.has(a.id) || splits.has(b.id)) continue
      if (uf.find(a.id) === uf.find(b.id)) continue
      if (a.skeletonHash && a.skeletonHash === b.skeletonHash && pHashDistance(a.pHash, b.pHash) <= T_MERGE_PHASH) {
        uf.union(a.id, b.id)
      }
    }
  }
  // forced merges (override)
  for (const grp of overrides.merges ?? []) {
    for (let i = 1; i < grp.length; i++) {
      if (byId.has(grp[0]) && byId.has(grp[i])) uf.union(grp[0], grp[i])
    }
  }

  // canonical node per merge-class
  const classMembers = new Map<string, GraphNode[]>()
  for (const n of nodes) {
    const root = uf.find(n.id)
    const arr = classMembers.get(root)
    if (arr) arr.push(n)
    else classMembers.set(root, [n])
  }
  const canonicalOf = new Map<string, string>()
  const canonicalNodes: GraphNode[] = []
  const repOfClass = new Map<string, string>()
  for (const [root, members] of classMembers) {
    const rep = pickRepresentative(members)
    repOfClass.set(root, rep.id)
    for (const m of members) canonicalOf.set(m.id, rep.id)
  }
  // preserve input order for canonicalNodes
  for (const n of nodes) {
    if (canonicalOf.get(n.id) === n.id) canonicalNodes.push(n)
  }

  // ── 2. CLUSTER into logical screens ───────────────────────────────────────
  // Skeleton EQUALITY only — a true equivalence relation. The earlier
  // `|| pHashDistance <= 14` term was non-transitive (within-14 is not transitive; the
  // triangle inequality allows 28), so union-find chained far-apart endpoints into one
  // family — on tuyo a single 29-member family spanning 13 distinct skeletons. The pixel
  // band was also the wrong tool for its stated job: real cross-skeleton state variants
  // (earn / earn-funded) sit ~24 apart, outside any sane band, and are grouped
  // deterministically via overrides.stateGroup instead.
  const cuf = new UnionFind()
  for (const n of canonicalNodes) cuf.add(n.id)
  for (let i = 0; i < canonicalNodes.length; i++) {
    for (let j = i + 1; j < canonicalNodes.length; j++) {
      const a = canonicalNodes[i]
      const b = canonicalNodes[j]
      if (splits.has(a.id) || splits.has(b.id)) continue
      if (a.skeletonHash && a.skeletonHash === b.skeletonHash) cuf.union(a.id, b.id)
    }
  }

  const familyMembers = new Map<string, GraphNode[]>()
  for (const n of canonicalNodes) {
    const root = cuf.find(n.id)
    const arr = familyMembers.get(root)
    if (arr) arr.push(n)
    else familyMembers.set(root, [n])
  }
  const logicalOf = new Map<string, string>()
  const members = new Map<string, string[]>()
  for (const fam of familyMembers.values()) {
    const rep = pickRepresentative(fam)
    const ordered = [rep, ...fam.filter((n) => n.id !== rep.id)]
    members.set(rep.id, ordered.map((n) => n.id))
    for (const n of fam) logicalOf.set(n.id, rep.id)
  }

  return { canonicalOf, logicalOf, members, canonicalNodes }
}
