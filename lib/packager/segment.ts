// Journey segmentation: build a navigation tree of journeys from a DOMINATOR TREE.
//
// The flow tree is the dominator tree of the app's nav/overlay subgraph. idom(X) — the
// single screen every path to X must pass through — is X's parent: a journey nests under
// whatever you must go through to reach it (Send under Home, Privacy under Settings, Buy
// under an asset detail). A chain in the dominator tree (each screen dominating exactly one
// onward child) is a TRUNK; a screen that dominates >=2 onward children is a HUB whose
// children each start a child flow.
//
// Anchors root their OWN top-level tree (a virtual super-source dominates them, so idom is
// the super-source): entry points (the launch root + screens nothing navigates to),
// completion hubs (home / launch screens), and main-navigation roots (graph.mainNav). A
// main-nav section is a peer, not a child of whatever screen launched it.
//
// Two structural facts fall out of the dominator tree, replacing the old distance heuristic:
//   • EXCURSIONS — a picker/peek sheet launched from a trunk screen S that only pops back to
//     S dominates nothing and returns to its dominator. It is NOT a branch (it must not
//     shatter the trunk) and, here in segmentation, is not emitted as its own flow. (Stage 3
//     weaves it back in as an inline picker step.)
//   • CROSS-SECTION JOURNEYS — a journey reachable from N sections has the super-source as
//     its common dominator, so the tree would hoist it to the top. We instead RE-EMIT it
//     under each reaching section (Adding money under both Home and Earn), per the locked
//     decision — the dominator tree governs trunk/nesting shape, not dedup-by-hoisting.
//
// Hand corrections to the derived tree live in overrides.structure (applied last).

import type { GraphEdge, Overrides } from "./types.ts"
import type { Adjacency } from "./graph.ts"
import type { SafResult } from "./saf.ts"
import type { ClassifyResult } from "./classify.ts"

// Safety cap on one flow's trunk length. The dominator tree is acyclic so a trunk can't loop;
// this just bounds a pathologically long linear chain so a single flow can't swallow the whole
// graph. Generous by design — a long but legitimate onboarding (tuyo's is ~16 once pickers are
// woven in) must fit. When the cap DOES bite it splits the trunk into a parent + child rather
// than dropping steps; segment reports those flows in `truncated` so a cap-hit is never silent.
const MAX_TRUNK = 20

// The virtual super-source that dominates every anchor. Cannot collide with a node id.
const SUPER = "⊤" // ⊤

export interface Journey {
  id: string
  entries: string[]
  /** ordered node ids: the launch screen (shared with the parent) + this flow's trunk */
  steps: string[]
  parent: string | null
  goal: string
}

export interface SegmentResult {
  journeys: Journey[]
  /** stable ids of flows whose linear trunk was cut by MAX_TRUNK (split into parent+child). */
  truncated: string[]
  /** main-nav section node ids the walk left empty (declared in graph.mainNav, no journey). */
  emptyNavRoots: string[]
  /** launcher node id → its excursion node ids (ordered): pickers/peeks that pop back to the
   *  launcher. They are NOT in any journey's `steps`; index.ts weaves them inline as picker
   *  steps right after their launcher so the forward trunk stays intact. */
  excursionsByLauncher: Map<string, string[]>
}

export function segment(
  saf: SafResult,
  cls: ClassifyResult,
  adj: Adjacency,
  edges: GraphEdge[],
  root: string,
  navRoots: Set<string> = new Set(),
  overrides: Overrides = {},
  // Authored branch order: a decision node's canonical id -> (canonical target id -> option index).
  // When a branching screen has a decisionPoint, its children render in the AUTHORED option order,
  // not lexically. A target reached by several options keeps its first (smallest) index. Falls
  // back to edge observedAtStep, then lexical id.
  decisionOrder: Map<string, Map<string, number>> = new Map()
): SegmentResult {
  const folded = new Set<string>()
  for (const [id, r] of cls.route) if (r === "toggle") folded.add(id)

  const indeg = (id: string) => (adj.in.get(id) ?? []).filter((e) => !folded.has(e.from)).length
  const outAll = (id: string) => (adj.out.get(id) ?? []).filter((e) => !folded.has(e.to) && e.to !== id)
  const isFamilyDefault = (id: string) => {
    const logical = saf.logicalOf.get(id) ?? id
    const members = saf.members.get(logical)
    if (!members || members.length === 1) return true
    return cls.defaultOf.get(logical) === id
  }
  const live = saf.canonicalNodes.filter((n) => !folded.has(n.id)).map((n) => n.id)

  // Forward subgraph for the dominator tree: nav + overlay edges, PLUS in-place edges that cross
  // SAF families. classify only folds in-place edges WITHIN one family (a state toggle); a
  // cross-family in-place edge — e.g. one assemble.ts forced from a coarse-skeleton nav, then
  // pinned distinct via overrides.splits — is a real navigation between two logical screens. If we
  // dropped it here while `indeg` still counted it, its target (and everything reachable only
  // through it) would vanish from every flow. Invariant: no recorded transition to a surviving,
  // unfolded screen may silently disappear from the flow tree. (back edges are still dropped.)
  const crossFamilyInPlace = (e: GraphEdge) =>
    e.kind === "in-place" && (saf.logicalOf.get(e.from) ?? e.from) !== (saf.logicalOf.get(e.to) ?? e.to)
  const subOut = new Map<string, string[]>()
  for (const id of live) subOut.set(id, [])
  for (const e of edges) {
    if (e.kind !== "nav" && e.kind !== "overlay" && !crossFamilyInPlace(e)) continue
    if (folded.has(e.from) || folded.has(e.to) || e.from === e.to) continue
    const l = subOut.get(e.from)
    if (l && !l.includes(e.to)) l.push(e.to)
  }

  // Top-level anchors — nodes that root their OWN tree. One concept, three sources (unioned):
  //   • entry points    — the launch root + screens nothing navigates to
  //   • completion hubs  — home / launch screens
  //   • nav sections     — main-nav destinations from graph.mainNav
  // Anchor order must NOT depend on the nodes input order — it fixes journey emission order,
  // the flows array, and the `slug`/`slug-2` disambiguation between same-named flows. So sort
  // the discovered entries/hubs lexically; the dominator numbering (:124) already sorts, but
  // succ(SUPER) and the build() loop (:255) read anchorOrder directly.
  const nodeById = new Map(saf.canonicalNodes.map((n) => [n.id, n]))
  const entries = live.filter((id) => id !== root && isFamilyDefault(id) && indeg(id) === 0).sort()
  const hubs = live.filter((id) => id !== root && isFamilyDefault(id) && nodeById.get(id)!.role === "home").sort()
  const anchors = new Set<string>()
  const anchorOrder: string[] = []
  // root first; then entries, then hubs (both sorted); then nav sections in authored graph.mainNav order.
  for (const id of [root, ...entries, ...hubs, ...navRoots]) if (!anchors.has(id)) { anchors.add(id); anchorOrder.push(id) }

  // ── Dominator tree (iterative Cooper–Harvey–Kennedy over SUPER → anchors → subgraph) ──
  // The super-source has an edge to every anchor, so idom(anchor) = SUPER (top-level) and
  // idom(X) for any other reachable X is the screen you must pass through to reach it. The
  // iterative fixpoint is order-independent (idom is a property of the graph); neighbours are
  // walked in sorted order only so the reverse-postorder numbering is reproducible.
  const succ = (id: string): string[] => (id === SUPER ? anchorOrder : subOut.get(id) ?? [])
  const post: string[] = []
  const seenDfs = new Set<string>([SUPER])
  const stack: { node: string; kids: string[]; i: number }[] = [{ node: SUPER, kids: [...anchorOrder].sort(), i: 0 }]
  while (stack.length) {
    const top = stack[stack.length - 1]
    if (top.i < top.kids.length) {
      const nx = top.kids[top.i++]
      if (!seenDfs.has(nx)) { seenDfs.add(nx); stack.push({ node: nx, kids: [...succ(nx)].sort(), i: 0 }) }
    } else { post.push(top.node); stack.pop() }
  }
  const rpo = post.slice().reverse()
  const rpoNum = new Map(rpo.map((n, i) => [n, i]))
  const preds = new Map<string, string[]>()
  for (const u of [SUPER, ...live]) for (const v of succ(u)) (preds.get(v) ?? preds.set(v, []).get(v)!).push(u)
  const idom = new Map<string, string>([[SUPER, SUPER]])
  const intersect = (a: string, b: string) => {
    while (a !== b) {
      while ((rpoNum.get(a) ?? 0) > (rpoNum.get(b) ?? 0)) a = idom.get(a)!
      while ((rpoNum.get(b) ?? 0) > (rpoNum.get(a) ?? 0)) b = idom.get(b)!
    }
    return a
  }
  let changed = true
  while (changed) {
    changed = false
    for (const b of rpo) {
      if (b === SUPER) continue
      let ni: string | undefined
      for (const p of preds.get(b) ?? []) if (idom.has(p)) ni = ni === undefined ? p : intersect(p, ni)
      if (ni !== undefined && idom.get(b) !== ni) { idom.set(b, ni); changed = true }
    }
  }

  const domKids = new Map<string, string[]>()
  for (const n of live) {
    const d = idom.get(n)
    if (d === undefined) continue // unreachable in the subgraph — a screen, never a flow step
    ;(domKids.get(d) ?? domKids.set(d, []).get(d)!).push(n)
  }
  const isAncestor = (a: string, x: string) => {
    let c = idom.get(x)
    while (c !== undefined && c !== SUPER) { if (c === a) return true; c = idom.get(c) }
    return false
  }

  // EXCURSIONS — a picker/peek launched from its dominator S that only pops back to S. It is a
  // dominator-tree leaf, directly launched from S, with a return edge to S (or to an ancestor).
  // Structural, no distance proxy: it subsumes the old isSideTarget. Convergent sheets (reached
  // from several deep screens, e.g. avici's high-impact-warning) are NOT excursions — they are
  // not launched directly from their common dominator, so they stay as a shared leaf there.
  const excursion = new Set<string>()
  for (const x of live) {
    const s = idom.get(x)
    if (s === undefined || s === SUPER) continue
    if ((domKids.get(x) ?? []).length > 0) continue // not a leaf
    if (!(subOut.get(s) ?? []).includes(x)) continue // not launched directly from its dominator
    const returns = outAll(x).some((e) => e.to === s || isAncestor(e.to, x))
    if (returns) excursion.add(x)
  }

  // CROSS-SECTION journeys: a node whose common dominator is the super-source but that isn't
  // itself an anchor is reachable from >=2 sections. It is re-emitted under each reaching
  // section (see forwardChildren) rather than hoisted to the top.
  const shared = new Set<string>()
  for (const n of live) if (idom.get(n) === SUPER && !anchors.has(n)) shared.add(n)

  // Onward (branch-bearing) children of a screen: the screens it dominates, plus any
  // cross-section journey it launches (re-emitted here), minus excursions. Ordered by the
  // authored decisionPoint option order, then observed-walk order, then lexical id.
  const dpRank = (cur: string, to: string) => {
    const i = decisionOrder.get(cur)?.get(to)
    return i === undefined ? Number.MAX_SAFE_INTEGER : i
  }
  const obsStep = (cur: string, to: string) => {
    let best = Number.MAX_SAFE_INTEGER
    for (const e of outAll(cur)) if (e.to === to && e.observedAtStep < best) best = e.observedAtStep
    return best
  }
  const order = (cur: string) => (a: string, b: string) =>
    dpRank(cur, a) - dpRank(cur, b) || obsStep(cur, a) - obsStep(cur, b) || (a < b ? -1 : 1)
  const rawChildren = (cur: string): string[] => {
    const out: string[] = []
    for (const k of domKids.get(cur) ?? []) if (!excursion.has(k)) out.push(k)
    for (const x of subOut.get(cur) ?? []) if (shared.has(x) && !excursion.has(x) && !out.includes(x)) out.push(x)
    return out
  }
  const isLeafChild = (c: string) => rawChildren(c).length === 0
  // §2c — homogeneous detail fan-out: when a hub's children include several LEAF siblings that
  // are the same logical screen (one SAF family: tapping any asset row opens an identical detail
  // screen), they are instances of ONE pattern, not N journeys. Keep the first (the exemplar,
  // by the order below) and drop the rest — they stay browsable in the Screens tab. A child with
  // its own onward trunk (e.g. an asset you can go on to Buy) is never collapsed away.
  const forwardChildren = (cur: string): string[] => {
    const sorted = rawChildren(cur).sort(order(cur))
    const seenFamily = new Set<string>()
    const kept: string[] = []
    for (const c of sorted) {
      if (isLeafChild(c)) {
        const fam = saf.logicalOf.get(c) ?? c
        const members = saf.members.get(fam)
        if (members && members.length > 1) {
          if (seenFamily.has(fam)) continue
          seenFamily.add(fam)
        }
      }
      kept.push(c)
    }
    return kept
  }

  type Raw = { id: string; entry: string; steps: string[]; parent: string | null; goal: string }
  const raws: Raw[] = []
  let flowSeq = 0
  const truncatedRaw = new Set<string>()
  // Walk a trunk down the dominator tree from `start`; at a hub (>=2 onward children) end the
  // flow and recurse into each child. A fresh seen-set per child duplicates a cross-section
  // journey under each section it nests in and guards against any residual cycle.
  function build(launch: string | null, start: string, parentId: string | null, seen: Set<string>) {
    const trunk: string[] = launch !== null ? [launch] : []
    let cur: string | undefined = start
    let conts: string[] = []
    while (cur && !seen.has(cur) && trunk.length < MAX_TRUNK) {
      trunk.push(cur)
      seen.add(cur)
      conts = forwardChildren(cur).filter((c) => !seen.has(c))
      if (conts.length === 1) { cur = conts[0]; continue }
      break
    }
    const myId = `f${flowSeq++}`
    if (trunk.length >= MAX_TRUNK && conts.length === 1) truncatedRaw.add(myId)
    raws.push({ id: myId, entry: trunk[0], steps: trunk, parent: parentId, goal: trunk[trunk.length - 1] })
    for (const c of conts) build(trunk[trunk.length - 1], c, myId, new Set(seen))
  }
  for (const a of anchorOrder) build(null, a, null, new Set())

  // Dedupe exact same-path-under-same-parent raws (defensive; the dominator walk shouldn't
  // produce any). The key is the FULL step path INCLUDING the launch screen: cross-section
  // copies share the same trunk but differ in their launch screen (Home vs Earn), and the
  // locked decision keeps both — so they must NOT collapse here.
  const byPath = new Map<string, Journey>()
  const mergedInto = new Map<string, string>()
  const journeys: Journey[] = []
  for (const r of raws) {
    const key = `${r.parent ?? ""}#${r.steps.join(">")}`
    const existing = byPath.get(key)
    if (existing) {
      if (!existing.entries.includes(r.entry)) existing.entries.push(r.entry)
      mergedInto.set(r.id, existing.id)
      continue
    }
    const j: Journey = { id: r.id, entries: [r.entry], steps: r.steps, parent: r.parent, goal: r.goal }
    byPath.set(key, j)
    journeys.push(j)
  }
  for (const j of journeys) if (j.parent && mergedInto.has(j.parent)) j.parent = mergedInto.get(j.parent)!

  // Drop lone feature flows (a single screen with no children) — not journeys. A main-nav
  // section the walk left empty (its only link leads to another tab, e.g. avici `card`) is NOT
  // force-kept: an empty section is a CAPTURE GAP, reported via emptyNavRoots so build-data can
  // warn and prompt a re-capture, rather than papering over the gap with a one-screen flow.
  const hasChild = new Set<string>()
  for (const j of journeys) if (j.parent) hasChild.add(j.parent)
  const kept = journeys.filter((j) => j.steps.length > 1 || hasChild.has(j.id))
  const emptyNavRoots = [...navRoots].filter((nr) => !kept.some((j) => j.parent === null && j.steps[0] === nr))

  // Stable public ids (goal-based, disambiguated) so overrides.structure can reference a flow's
  // SHAPE across runs. (Display NAMES are keyed separately, by a parent-independent trunk key —
  // see index.ts — so the cross-section copies can share one authored name.)
  const stableOf = new Map<string, string>()
  const usedStable = new Set<string>()
  for (const j of kept) {
    let id = j.goal
    if (usedStable.has(id)) id = `${j.goal}@${j.entries[0]}`
    const base = id
    let n = 2
    while (usedStable.has(id)) id = `${base}-${n++}`
    usedStable.add(id)
    stableOf.set(j.id, id)
  }
  for (const j of kept) {
    if (j.parent) j.parent = stableOf.get(j.parent) ?? j.parent
    j.id = stableOf.get(j.id)!
  }

  // Structure overrides — the one hand lever over the derived tree's SHAPE, keyed by stable flow
  // id and applied LAST so it always wins. `parent` re-parents a flow under another, or pins it
  // to the root with `parent: null`. A self-parent is ignored; a dangling parent falls back to
  // top-level downstream (index.ts resolves an unknown parent to null).
  const st = overrides.structure ?? {}
  if (Object.keys(st).length) {
    for (const j of kept) {
      const o = st[j.id]
      if (o && o.parent !== undefined && o.parent !== j.id) j.parent = o.parent
    }
  }

  // Group excursions under their launcher (idom), ordered like any sibling set, for index.ts to
  // weave inline as picker steps. Only launchers that survive as a flow step matter, but we map
  // them all — index.ts weaves where the launcher actually appears.
  const excursionsByLauncher = new Map<string, string[]>()
  for (const x of excursion) {
    const s = idom.get(x)!
    ;(excursionsByLauncher.get(s) ?? excursionsByLauncher.set(s, []).get(s)!).push(x)
  }
  for (const [s, xs] of excursionsByLauncher) xs.sort(order(s))

  const truncated = [...truncatedRaw].map((r) => stableOf.get(r)).filter((x): x is string => !!x)
  return { journeys: kept, truncated, emptyNavRoots, excursionsByLauncher }
}
