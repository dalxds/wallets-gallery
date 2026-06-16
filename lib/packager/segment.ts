// Journey segmentation: build a navigation tree of journeys.
//
// Walk forward from each entry point. A screen with a single forward step extends
// the current trunk; a screen that BRANCHES (>=2 forward steps) ends the current
// flow and each branch becomes a CHILD flow that starts from that screen. So a
// journey nests under whatever it launches from — Send under Home, Privacy under
// Settings, Request under Receive — all the way up. Pickers / modals flow through
// as side-screens (browsable in the Screens tab), never their own flow.
//
// Two anchors break the nest-under-launcher rule and root their OWN top-level tree:
// completion hubs (home / launch screens — see `completionHubs`) and main-navigation roots
// (`navRoots`, from graph.mainNav — a bottom-tab bar, nav rail, or drawer). A main-nav
// section is a peer, not a child of whatever screen launched it, so it gets its own
// top-level subtree instead of nesting under the launcher.
// Hand corrections to the derived tree live in overrides.structure (applied last).

import type { GraphEdge, Overrides } from "./types.ts"
import type { Adjacency } from "./graph.ts"
import type { SafResult } from "./saf.ts"
import type { ClassifyResult } from "./classify.ts"

// Safety cap on one flow's trunk length. The seen-set/cycle guard in build() is the
// real protection against runaway trunks; this just bounds a pathologically long linear
// chain so a single flow can't swallow the whole graph. Generous by design.
const MAX_TRUNK = 14

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
  dist: Map<string, number>
}

export function segment(
  saf: SafResult,
  cls: ClassifyResult,
  adj: Adjacency,
  edges: GraphEdge[],
  root: string,
  navRoots: Set<string> = new Set(),
  overrides: Overrides = {}
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

  // Top-level starts: the root + entry points nothing navigates to.
  const topStarts: string[] = []
  const seenTop = new Set<string>()
  const pushTop = (id: string) => {
    if (!seenTop.has(id)) {
      seenTop.add(id)
      topStarts.push(id)
    }
  }
  pushTop(root)
  for (const n of saf.canonicalNodes) {
    if (!folded.has(n.id) && isFamilyDefault(n.id) && indeg(n.id) === 0) pushTop(n.id)
  }

  // Distance from the NEAREST entry (multi-source BFS) so disconnected sections
  // still get a forward order — single-source-from-root leaves them at Infinity.
  const dist = new Map<string, number>()
  {
    const q = [...topStarts]
    for (const s of topStarts) dist.set(s, 0)
    while (q.length) {
      const c = q.shift()!
      const d = dist.get(c)!
      for (const e of adj.out.get(c) ?? []) if (!dist.has(e.to)) { dist.set(e.to, d + 1); q.push(e.to) }
    }
  }
  const distOf = (id: string) => dist.get(id) ?? Number.MAX_SAFE_INTEGER

  // Completion hubs = home / launch screens. Reaching one COMPLETES a journey
  // (onboarding → unfunded home, sign-in → funded home). Sub-sections (Settings,
  // Discover) are NOT hubs — they nest with their children.
  const completionHubs = new Set<string>([root])
  for (const n of saf.canonicalNodes) {
    if (!folded.has(n.id) && isFamilyDefault(n.id) && n.role === "home") completionHubs.add(n.id)
  }

  // Does a screen lead onward (a forward/hub nav exit)? Used to tell a pass-through
  // modal (captcha → home, confirmation → next) from a dismissable side-modal.
  const leadsOnward = (id: string) =>
    outAll(id).some((e) => e.kind === "nav" && (distOf(e.to) >= distOf(id) || completionHubs.has(e.to)))
  // Exits that ADVANCE a journey: a non-backward nav (>= handles DAG shortcuts like
  // welcome→email vs welcome→more-options→email), an edge to a hub, or an overlay
  // into a pass-through modal that itself leads onward.
  const advancingExits = (id: string) =>
    outAll(id).filter(
      (e) =>
        (e.kind === "nav" && (distOf(e.to) >= distOf(id) || completionHubs.has(e.to))) ||
        (e.kind === "overlay" && leadsOnward(e.to))
    )
  // A target is a side-screen (picker/modal/dropdown) if it only returns — no
  // advancing exit of its own — and isn't itself a hub.
  const isSideTarget = (toId: string) =>
    !completionHubs.has(toId) &&
    advancingExits(toId).length === 0 &&
    outAll(toId).some((x) => distOf(x.to) < distOf(toId))
  const continuations = (cur: string, seen: Set<string>) =>
    advancingExits(cur)
      .map((e) => e.to)
      .filter((to) => !seen.has(to) && !isSideTarget(to))
      .sort((a, b) => distOf(a) - distOf(b) || (a < b ? -1 : 1))

  // Can `node` reach a completion hub via forward steps? Computed as a fixpoint over
  // the continuation graph (NOT memoized recursion): a node reaches a hub iff one of
  // its continuations is a hub or itself reaches one. Seeding from hub-adjacent nodes
  // and propagating backward is cycle-proof — a recursive memo would cache the `false`
  // its own on-stack cycle guard produced and wrongly mark a looping branch as dead.
  const conts = new Map<string, string[]>()
  const contsOf = (id: string) => {
    let c = conts.get(id)
    if (!c) { c = continuations(id, new Set()); conts.set(id, c) }
    return c
  }
  const reachesHubSet = new Set<string>()
  {
    const preds = new Map<string, string[]>()
    const queue: string[] = []
    for (const n of saf.canonicalNodes) {
      const cs = contsOf(n.id)
      for (const c of cs) (preds.get(c) ?? preds.set(c, []).get(c)!).push(n.id)
      if (cs.some((c) => completionHubs.has(c))) { reachesHubSet.add(n.id); queue.push(n.id) }
    }
    while (queue.length) {
      const cur = queue.shift()!
      for (const p of preds.get(cur) ?? []) if (!reachesHubSet.has(p)) { reachesHubSet.add(p); queue.push(p) }
    }
  }
  const reachesHub = (node: string) => reachesHubSet.has(node)

  type Raw = { id: string; entry: string; steps: string[]; parent: string | null; goal: string }
  const raws: Raw[] = []
  let flowSeq = 0

  // FEATURE journeys (hub → leaf, branch-nested). Continuations heading toward a
  // completion hub are excluded — those become completion journeys below. Nav roots
  // are excluded too: a main-nav destination is never a child, it roots its own tree.
  const featureConts = (cur: string, seen: Set<string>) =>
    continuations(cur, seen).filter((c) => !completionHubs.has(c) && !navRoots.has(c) && !reachesHub(c))
  function build(steps0: string[], start: string, parentId: string | null, seen: Set<string>) {
    const trunk = [...steps0]
    let cur: string | undefined = start
    let conts: string[] = []
    while (cur && !seen.has(cur) && trunk.length < MAX_TRUNK) {
      trunk.push(cur)
      seen.add(cur)
      if ((completionHubs.has(cur) || navRoots.has(cur)) && cur !== trunk[0]) {
        conts = []
        break
      }
      conts = featureConts(cur, seen)
      if (conts.length === 1) {
        cur = conts[0]
        continue
      }
      break
    }
    const myId = `f${flowSeq++}`
    raws.push({ id: myId, entry: trunk[0], steps: trunk, parent: parentId, goal: trunk[trunk.length - 1] })
    for (const c of conts) build([trunk[trunk.length - 1]], c, myId, new Set(seen))
  }
  // TOP-LEVEL ANCHORS — nodes that root their OWN tree instead of nesting under a launcher.
  // One concept, three sources (unioned — any source makes a node top-level):
  //   • entry points    — the launch root + screens nothing navigates to   (topStarts)
  //   • completion hubs  — home / launch screens                            (completionHubs)
  //   • nav sections     — main-nav destinations from graph.mainNav         (navRoots)
  // So the home tree builds even when reached from onboarding (home is a hub), and each
  // main-nav section roots its own tree instead of hanging off whatever launched it.
  // (Completion hubs additionally mark where a journey ENDS — see the completion journeys below.)
  const topLevelAnchors: string[] = []
  const seenAnchor = new Set<string>()
  for (const id of [...topStarts, ...completionHubs, ...navRoots]) if (!seenAnchor.has(id)) { seenAnchor.add(id); topLevelAnchors.push(id) }
  for (const s of topLevelAnchors) build([], s, null, new Set())

  // COMPLETION journeys: shortest path from each entry to each reachable hub
  // (onboarding/sign-in). Distinct full paths, never split into a shared funnel flow.
  const shortestToHub = (from: string, target: string): string[] | null => {
    if (from === target) return null
    const prev = new Map<string, string>()
    const visited = new Set<string>([from])
    const q = [from]
    while (q.length) {
      const c = q.shift()!
      for (const nx of continuations(c, new Set())) {
        if (visited.has(nx)) continue
        visited.add(nx)
        prev.set(nx, c)
        if (nx === target) {
          const path = [target]
          let p = c
          while (p !== from) {
            path.push(p)
            p = prev.get(p)!
          }
          path.push(from)
          return path.reverse()
        }
        if (!completionHubs.has(nx)) q.push(nx) // don't traverse past an intermediate hub
      }
    }
    return null
  }
  for (const E of topStarts) {
    for (const H of completionHubs) {
      if (H === E) continue
      const path = shortestToHub(E, H)
      if (path && path.length >= 2) raws.push({ id: `f${flowSeq++}`, entry: E, steps: path, parent: null, goal: H })
    }
  }

  // Merge same-path-under-same-parent (different entry only); remap merged ids.
  const byPath = new Map<string, Journey>()
  const mergedInto = new Map<string, string>()
  const journeys: Journey[] = []
  for (const r of raws) {
    const key = `${r.parent ?? ""}#${r.steps.slice(1).join(">")}|${r.goal}`
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

  // Drop lone feature flows (a single screen with no children) — not journeys.
  const hasChild = new Set<string>()
  for (const j of journeys) if (j.parent) hasChild.add(j.parent)
  const kept = journeys.filter((j) => j.steps.length > 1 || hasChild.has(j.id))

  // Stable public ids (goal-based, disambiguated) so overrides.flowNames can
  // reference them across runs.
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

  // Structure overrides — the one hand lever over the derived tree's SHAPE, keyed by
  // stable flow id and applied LAST so it always wins. `parent` re-parents a flow under
  // another, or pins it to the root with `parent: null`. (Main-nav sections are handled
  // generally via navRoots above — they never need an override here.) A self-parent is
  // ignored; a dangling parent falls back to top-level downstream (index.ts resolves an
  // unknown parent to null).
  const st = overrides.structure ?? {}
  if (Object.keys(st).length) {
    for (const j of kept) {
      const o = st[j.id]
      if (o && o.parent !== undefined && o.parent !== j.id) j.parent = o.parent
    }
  }

  return { journeys: kept, dist }
}
