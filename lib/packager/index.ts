// package(graph) → View. The single deterministic transform: same graph.json
// (incl. overrides) always yields the same View. Run by the SSG build and the CLI.

import type { Graph, GraphEdge, Overrides, View, ViewFlow, ViewScreen, ViewStep } from "./types.ts"
import { runSAF } from "./saf.ts"
import { classify } from "./classify.ts"
import { segment } from "./segment.ts"
import { buildAdjacency } from "./graph.ts"
import { screenTitle, journeyName, slugify, nameKeyOf, type FlowName } from "./naming.ts"
import { buildReplay } from "./replay.ts"

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
    const prev = edgeByKey.get(key)
    if (!prev) { edgeByKey.set(key, { ...e, from, to }); edgeOrder.push(key) }
    else if (prev.kind !== "in-place" && e.kind === "in-place") edgeByKey.set(key, { ...e, from, to })
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
  const edgeBetween = (a: string, b: string) => edges.find((e) => e.from === a && e.to === b) ?? null

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
    const steps: ViewStep[] = j.steps.map((nid, idx) => {
      const node = nodeById.get(nid)!
      const e = idx > 0 ? edgeBetween(j.steps[idx - 1], nid) : null
      const list = appearsIn.get(nid) ?? []
      list.push({ flow: slug, step: idx + 1 })
      appearsIn.set(nid, list)
      if (!nodeToFlow.has(nid)) nodeToFlow.set(nid, slug)
      return {
        number: idx + 1,
        title: screenTitle(node, overridesC),
        screenId: nid,
        action: idx === 0 ? "Entry point" : e?.action ?? "Navigate",
        screenshotPath: node.screenshotPath,
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
      replay: buildReplay(j.entries[0], j.steps, nodeById, edgeBetween, graph.meta.app.bundleId, root),
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
