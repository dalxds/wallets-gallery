// package(graph) → View. The single deterministic transform: same graph.json
// (incl. overrides) always yields the same View. Run by the SSG build and the CLI.

import type { Graph, GraphEdge, View, ViewFlow, ViewScreen, ViewStep } from "./types.ts"
import { runSAF } from "./saf.ts"
import { classify } from "./classify.ts"
import { segment } from "./segment.ts"
import { buildAdjacency } from "./graph.ts"
import { screenTitle, journeyName, slugify } from "./naming.ts"
import { buildReplay } from "./replay.ts"

export function packageGraph(graph: Graph): View {
  const overrides = graph.overrides ?? {}
  const saf = runSAF(graph.nodes, overrides)
  const canon = (id: string) => saf.canonicalOf.get(id) ?? id

  // Remap edges to canonical ids; drop self-loops; dedupe by (from,to,action).
  const seenEdge = new Set<string>()
  const edges: GraphEdge[] = []
  for (const e of graph.edges) {
    const from = canon(e.from)
    const to = canon(e.to)
    if (from === to) continue
    const key = `${from}->${to}|${e.action}`
    if (seenEdge.has(key)) continue
    seenEdge.add(key)
    edges.push({ ...e, from, to })
  }

  const canonIds = saf.canonicalNodes.map((n) => n.id)
  const adj = buildAdjacency(canonIds, edges)
  const root = canon(graph.root)
  const cls = classify(saf, adj, edges, overrides)
  const seg = segment(saf, cls, adj, edges, root)

  const nodeById = new Map(saf.canonicalNodes.map((n) => [n.id, n]))
  const edgeBetween = (a: string, b: string) => edges.find((e) => e.from === a && e.to === b) ?? null

  // Slugs (assigned before steps so parent refs resolve).
  const slugByJourney = new Map<string, string>()
  const used = new Set<string>()
  for (const j of seg.journeys) {
    const nm = journeyName(j, nodeById.get(j.goal), overrides)
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
    const nm = journeyName(j, nodeById.get(j.goal), overrides)
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
        title: screenTitle(node, overrides),
        screenId: nid,
        action: idx === 0 ? "Entry point" : e?.action ?? "Navigate",
        selector: idx === 0 ? null : e?.selector ?? null,
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
      title: screenTitle(n, overrides),
      role: overrides.screens?.[n.id]?.role ?? n.role,
      description: overrides.screens?.[n.id]?.description ?? "",
      screenshotPath: n.screenshotPath,
      fingerprint: n.fingerprint,
      texts: n.texts,
      interactiveElements: n.interactiveElements,
      primaryCta: n.primaryCta ?? null,
      secondaryCtas: n.secondaryCtas ?? [],
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
    },
    namingTODO,
  }
}

export type { Graph, View } from "./types.ts"
