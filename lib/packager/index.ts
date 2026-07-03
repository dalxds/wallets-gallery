// package(graph) → View. The single deterministic transform: same graph.json
// (incl. overrides) always yields the same View. Run by the SSG build and the CLI.

import type { Graph, GraphEdge, Overrides, View, ViewFlow, ViewScreen, ViewStep } from "./types.ts"
import { runSAF } from "./saf.ts"
import { classify } from "./classify.ts"
import { segment } from "./segment.ts"
import { buildAdjacency } from "./graph.ts"
import { screenTitle, journeyName, slugify, nameKeyOf, type FlowName } from "./naming.ts"
import { buildReplay } from "./replay.ts"

// Deterministic winner among edges sharing a (from,to,action) key. in-place wins first —
// it's the state-toggle signal classify needs (a nav/overlay duplicate would mask it) —
// then earliest observed, then selector (nulls last), then kind. A total order, so the
// survivor is the same regardless of graph.edges array order.
function betterEdge(a: GraphEdge, b: GraphEdge): GraphEdge {
  const ai = a.kind === "in-place" ? 0 : 1
  const bi = b.kind === "in-place" ? 0 : 1
  if (ai !== bi) return ai < bi ? a : b
  if (a.observedAtStep !== b.observedAtStep) return a.observedAtStep < b.observedAtStep ? a : b
  if (a.selector !== b.selector) { // lexically smallest, nulls last
    if (a.selector == null) return b
    if (b.selector == null) return a
    return a.selector < b.selector ? a : b
  }
  if (a.kind !== b.kind) return a.kind < b.kind ? a : b
  return a
}

export function packageGraph(graph: Graph): View {
  const overrides = graph.overrides ?? {}
  const saf = runSAF(graph.nodes, overrides)
  const canon = (id: string) => saf.canonicalOf.get(id) ?? id

  // overrides.screens is authored against RAW node ids; remap keys to canonical
  // (post-merge) ids so a correction on a node the SAF merged away still applies
  // to its canonical survivor instead of silently no-op'ing.
  const screenOv = overrides.screens ?? {}
  const canonScreens: NonNullable<Overrides["screens"]> = {}
  for (const id of Object.keys(screenOv)) {
    const c = canon(id)
    canonScreens[c] = { ...canonScreens[c], ...screenOv[id] }
  }
  const overridesC: Overrides = { ...overrides, screens: canonScreens }

  // Remap edges to canonical ids; drop self-loops; dedupe by (from,to,action).
  // On a collision prefer the in-place edge — it's the state-toggle signal classify
  // needs, and a nav/overlay duplicate would otherwise mask it (first-seen wins).
  const edgeByKey = new Map<string, GraphEdge>()
  const edgeOrder: string[] = []
  for (const e of graph.edges) {
    const from = canon(e.from)
    const to = canon(e.to)
    if (from === to) continue
    const key = `${from}->${to}|${e.action}`
    const remapped = { ...e, from, to }
    const prev = edgeByKey.get(key)
    if (!prev) { edgeByKey.set(key, remapped); edgeOrder.push(key) }
    else edgeByKey.set(key, betterEdge(remapped, prev))
  }
  const edges: GraphEdge[] = edgeOrder.map((k) => edgeByKey.get(k)!)

  const canonIds = saf.canonicalNodes.map((n) => n.id)
  const adj = buildAdjacency(canonIds, edges)
  const root = canon(graph.root)
  const cls = classify(saf, edges, overridesC)
  // Main-navigation destinations → canonical ids that survived merging. Each roots its
  // own top-level flow (see segment.ts); unknown ids are dropped.
  const canonSet = new Set(canonIds)
  const navRoots = new Set<string>()
  for (const t of graph.mainNav ?? []) {
    const c = canon(t)
    if (canonSet.has(c)) navRoots.add(c)
  }
  // Authored branch order (decisionPoints) → segment sibling ordering. Canonicalize the
  // decision node and each option's target so the order survives SAF merges; a target hit by
  // several options keeps its first (smallest) authored index.
  const decisionOrder = new Map<string, Map<string, number>>()
  for (const dp of graph.decisionPoints) {
    const node = canon(dp.nodeId)
    let m = decisionOrder.get(node)
    if (!m) { m = new Map(); decisionOrder.set(node, m) }
    dp.options.forEach((o, i) => {
      if (!o.toNode) return
      const to = canon(o.toNode)
      if (!m!.has(to)) m!.set(to, i)
    })
  }
  const seg = segment(saf, cls, adj, edges, root, navRoots, overridesC, decisionOrder)

  const nodeById = new Map(saf.canonicalNodes.map((n) => [n.id, n]))
  // Among parallel edges (same from/to, different action — SAF merges create these), pick
  // deterministically: smallest observedAtStep = the transition as first captured, which is
  // also the best step label; then lexically-smallest action, then selector (nulls last).
  // buildReplay is handed this same closure, so replay clicks stay deterministic too.
  const edgeBetween = (a: string, b: string) => {
    let best: GraphEdge | null = null
    for (const e of edges) {
      if (e.from !== a || e.to !== b) continue
      if (!best || e.observedAtStep < best.observedAtStep) { best = e; continue }
      if (e.observedAtStep > best.observedAtStep) continue
      if (e.action !== best.action) { if (e.action < best.action) best = e; continue }
      if (e.selector != null && (best.selector == null || e.selector < best.selector)) best = e
    }
    return best
  }

  // Names + slugs (assigned before steps so parent refs resolve). journeyName is
  // computed once here and reused when building the flows below. Name a flow by its first
  // DISTINCTIVE screen (steps[1] — the entry into its own trunk, past the launch screen
  // shared with the parent), not its deepest/goal screen: a multi-step journey reads by its
  // intent ("Withdraw Asset") rather than its last sheet ("Add bank details"). Single-step
  // flows (a hub/tab) have only steps[0], so fall back to the goal.
  // Mechanical name is a deterministic FALLBACK only — the real name comes from the LLM/human
  // (overrides.flowNames), which sees the whole journey via namingTODO.steps below. So keep this
  // dumb: the first distinctive screen (steps[1], past the shared launch screen), else the goal.
  const nameByJourney = new Map<string, FlowName>()
  const slugByJourney = new Map<string, string>()
  const used = new Set<string>()
  for (const j of seg.journeys) {
    const nameNode = nodeById.get(j.steps.length > 1 ? j.steps[1] : j.goal)
    const nm = journeyName(j, nameNode, overridesC)
    nameByJourney.set(j.id, nm)
    let slug = slugify(nm.name) || j.id
    const base = slug
    let i = 2
    while (used.has(slug)) slug = `${base}-${i++}`
    used.add(slug)
    slugByJourney.set(j.id, slug)
  }

  const appearsIn = new Map<string, { flow: string; step: number }[]>()
  const nodeToFlow = new Map<string, string>()
  const namingTODO: View["namingTODO"] = []
  const flows: ViewFlow[] = seg.journeys.map((j) => {
    const nm = nameByJourney.get(j.id)!
    const slug = slugByJourney.get(j.id)!
    // Weave plan: the forward trunk, with each launcher's excursions inserted right after it as
    // picker steps (so the spine continues from the launcher's forward exit — the next trunk
    // node — not from the picker). `from` is the node the step's action edge comes from: the
    // previous trunk node for a forward step, the launcher for a picker. A launcher owns its
    // excursions where it appears without duplicating a parent's: at a real trunk step (idx >= 1),
    // at its own single-node hub (steps.length === 1), or at steps[0] of a TOP-LEVEL flow —
    // which it owns (build() starts the trunk at the anchor itself). A CHILD flow's steps[0] is
    // the launch screen borrowed from its parent, so it still skips idx 0 (no double-weave).
    const plan: { node: string; kind: ViewStep["kind"]; from: string | null }[] = []
    j.steps.forEach((nid, idx) => {
      plan.push({ node: nid, kind: "forward", from: idx > 0 ? j.steps[idx - 1] : null })
      if (idx >= 1 || j.steps.length === 1 || j.parent === null) {
        for (const x of seg.excursionsByLauncher.get(nid) ?? []) plan.push({ node: x, kind: "picker", from: nid })
      }
    })
    const steps: ViewStep[] = plan.map((p, i) => {
      const node = nodeById.get(p.node)!
      const e = p.from ? edgeBetween(p.from, p.node) : null
      const list = appearsIn.get(p.node) ?? []
      list.push({ flow: slug, step: i + 1 })
      appearsIn.set(p.node, list)
      if (!nodeToFlow.has(p.node)) nodeToFlow.set(p.node, slug)
      return {
        number: i + 1,
        title: screenTitle(node, overridesC),
        screenId: p.node,
        action: p.from ? e?.action ?? "Navigate" : "Entry point",
        screenshotPath: node.screenshotPath,
        kind: p.kind,
      }
    })
    if (nm.source === "mechanical") {
      // Hand the namer the WHOLE journey (every step's screen + title), not just one screen,
      // so it can name from full context rather than re-deriving it from the view.
      namingTODO.push({
        entryNodeId: j.entries[0],
        nameKey: nameKeyOf(j),
        slug,
        mechanicalName: nm.name,
        steps: steps.map((s) => ({ id: s.screenId, title: s.title })),
      })
    }
    return {
      slug,
      name: nm.name,
      parent: j.parent ? slugByJourney.get(j.parent) ?? null : null,
      summary: "",
      entryPoints: j.entries,
      steps,
      replay: buildReplay(j.entries[0], plan, edgeBetween, nodeById, graph.meta.app.bundleId, root),
      nameSource: nm.source,
    }
  })

  // Screens (one per canonical node). State/stateGroup only when part of a toggle group.
  const screens: ViewScreen[] = saf.canonicalNodes.map((n) => {
    const grp = cls.stateGroup.get(n.id)
    return {
      id: n.id,
      title: screenTitle(n, overridesC),
      role: overridesC.screens?.[n.id]?.role ?? n.role,
      description: overridesC.screens?.[n.id]?.description ?? "",
      screenshotPath: n.screenshotPath,
      texts: n.texts,
      interactiveElements: n.interactiveElements,
      state: grp ? cls.state.get(n.id) : undefined,
      stateGroup: grp,
      appearsIn: appearsIn.get(n.id) ?? [],
    }
  })

  const decisionPoints = graph.decisionPoints.map((dp) => ({
    screenId: canon(dp.nodeId),
    options: dp.options.map((o) => ({
      label: o.label,
      explored: o.explored,
      flowSlug: o.toNode ? nodeToFlow.get(canon(o.toNode)) : undefined,
    })),
  }))

  const topLevelFlows = flows.filter((f) => f.parent === null).length
  const withReplay = flows.filter((f) => f.replay !== null).length

  return {
    app: graph.meta.app,
    captureDate: graph.meta.captureDate,
    screens,
    flows,
    decisionPoints,
    stats: {
      screens: screens.length,
      rawNodes: graph.nodes.length,
      flows: flows.length,
      topLevelFlows,
      replayCoverage: flows.length ? Math.round((withReplay / flows.length) * 100) : 0,
      truncatedFlows: seg.truncated.length,
    },
    namingTODO,
    uncapturedSections: seg.emptyNavRoots,
  }
}

export type { Graph, View } from "./types.ts"
