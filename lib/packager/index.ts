// package(graph) → View. The single deterministic transform: same graph.json
// (incl. overrides) always yields the same View. Run by the SSG build and the CLI.

import type { Graph, GraphEdge, Overrides, View, ViewFlow, ViewScreen, ViewStep } from "./types.ts"
import { runSAF } from "./saf.ts"
import { classify } from "./classify.ts"
import { segment } from "./segment.ts"
import { buildAdjacency } from "./graph.ts"
import { screenTitle, journeyName, slugify, type FlowName } from "./naming.ts"
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
  const seg = segment(saf, cls, adj, edges, root, navRoots, overridesC)

  const nodeById = new Map(saf.canonicalNodes.map((n) => [n.id, n]))
  const edgeBetween = (a: string, b: string) => edges.find((e) => e.from === a && e.to === b) ?? null

  // Names + slugs (assigned before steps so parent refs resolve). journeyName is
  // computed once here and reused when building the flows below.
  //
  // Slug assignment is pin-aware: metadata.flowSlugs[flowId] pins a flow's URL so a
  // rename (or a re-derived mechanical name) never moves it. Pins are placed first
  // — claiming their slot in `used` — so the generated slugs below dedup around
  // them. New flows (no pin) fall back to slugify(name) with numeric-suffix dedup,
  // exactly as before. Keyed by stable flow id (= anchor node id), like flowNames.
  const pins = graph.metadata?.flowSlugs ?? {}
  const nameByJourney = new Map<string, FlowName>()
  const slugByJourney = new Map<string, string>()
  const used = new Set<string>()
  const dedup = (base: string): string => {
    let slug = base
    let i = 2
    while (used.has(slug)) slug = `${base}-${i++}`
    used.add(slug)
    return slug
  }
  for (const j of seg.journeys) nameByJourney.set(j.id, journeyName(j, nodeById.get(j.goal), overridesC))
  for (const j of seg.journeys) {
    const pin = pins[j.id]
    if (pin) slugByJourney.set(j.id, dedup(pin))
  }
  for (const j of seg.journeys) {
    if (slugByJourney.has(j.id)) continue
    slugByJourney.set(j.id, dedup(slugify(nameByJourney.get(j.id)!.name) || j.id))
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
      namingTODO.push({ entryNodeId: j.entries[0], slug, mechanicalName: nm.name })
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

  // URL-continuity outputs. `flowSlugs` is the current flow-id→slug assignment
  // (what sync-slugs persists back as pins). Aliases are carried from metadata but
  // filtered to ones that still apply here: drop a redirect whose target is gone
  // (dead link) or whose source is now a live slug/id (the real thing must win).
  const flowSlugs: Record<string, string> = {}
  for (const j of seg.journeys) flowSlugs[j.id] = slugByJourney.get(j.id)!
  const filterAliases = (raw: Record<string, string>, live: Set<string>): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const [from, to] of Object.entries(raw)) {
      if (live.has(from) || !live.has(to)) continue
      out[from] = to
    }
    return out
  }
  const flowAliases = filterAliases(graph.metadata?.flowAliases ?? {}, new Set(slugByJourney.values()))
  const screenAliases = filterAliases(graph.metadata?.screenAliases ?? {}, new Set(screens.map((s) => s.id)))

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
    },
    namingTODO,
    flowSlugs,
    flowAliases,
    screenAliases,
  }
}

export type { Graph, View } from "./types.ts"
