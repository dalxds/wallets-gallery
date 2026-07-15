// packageGraph(graph, flows) → View. The deterministic semantic builder validates
// authored intent and performs only mechanical projection and best-effort replay.

import type {
  FlowDefinition,
  FlowsFile,
  Graph,
  View,
  ViewDiagnostic,
  ViewFlow,
  ViewScreen,
  ViewStep,
} from "./types.ts"
import { migrateFlows, orderFlows, validateFlows } from "./flows.ts"
import { authoredTransitions, buildReplay } from "./replay.ts"
import {
  buildInventory,
  edgeBetween,
  projectGraph,
  type ProjectedGraph,
} from "./project.ts"
import { screenTitle } from "./naming.ts"

export class FlowPackagingError extends Error {
  readonly errors: string[]

  constructor(errors: string[]) {
    super(`Invalid semantic flow package:\n  ${errors.join("\n  ")}`)
    this.name = "FlowPackagingError"
    this.errors = errors
  }
}

interface DerivedContext {
  screenId: string
  variationIds?: string[]
}

function deriveContext(
  projected: ProjectedGraph,
  flow: FlowDefinition,
  flowById: Map<string, FlowDefinition>
): DerivedContext | null {
  if (!flow.parentId) return null
  const parent = flowById.get(flow.parentId)
  if (!parent) return null
  const parentGroups = new Set(
    parent.steps.flatMap((screen) => {
      const group = projected.groupOf.get(screen)
      return group ? [group] : []
    })
  )
  const firstGroup = projected.groupOf.get(flow.steps[0])
  if (!firstGroup) return null
  const candidatesByGroup = new Map<string, Set<string>>()
  for (const edge of projected.edges) {
    if (edge.kind === "back") continue
    const fromGroup = projected.groupOf.get(edge.from)
    const toGroup = projected.groupOf.get(edge.to)
    if (!fromGroup || !toGroup) continue
    if (edge.kind === "in-place" && fromGroup === toGroup) continue
    if (toGroup !== firstGroup) continue
    if (!parentGroups.has(fromGroup)) continue
    if (fromGroup === firstGroup) continue
    const candidates = candidatesByGroup.get(fromGroup) ?? new Set<string>()
    candidates.add(edge.from)
    candidatesByGroup.set(fromGroup, candidates)
  }
  if (candidatesByGroup.size !== 1) return null
  const [group, candidates] = [...candidatesByGroup][0]
  const members = projected.membersByGroup.get(group) ?? [...candidates]
  const eligibleMembers = members.filter(
    (member) => candidates.has(member)
  )
  if (!eligibleMembers.length) return null
  return {
    screenId: eligibleMembers[0],
    ...(members.length > 1 ? { variationIds: eligibleMembers } : {}),
  }
}

function actionFor(
  projected: ProjectedGraph,
  authored: string[],
  index: number,
  context: DerivedContext | null
): string {
  if (index === 0 && !context) return "Entry point"
  const contextId = context?.screenId ?? null
  const from = index === 0 ? contextId : authored[index - 1]
  if (!from) return "Entry point"
  const direct = edgeBetween(projected, from, authored[index])
  if (direct) return direct.action
  const transition = authoredTransitions(projected, authored, contextId).find(
    (item) => item.index === index
  )
  const anchored = transition
    ? edgeBetween(projected, transition.from, transition.to)
    : null
  if (anchored) return anchored.action
  // Presentation can still name a recorded continuation when replay correctly
  // rejects an ambiguous or selector-less picker return. Prefer the nearest
  // earlier authored screen, then context, so a real action never degrades to
  // the generic label solely because an inline picker sits between the steps.
  const earlier = [...authored.slice(0, index)].reverse()
  if (contextId) earlier.push(contextId)
  for (const candidate of earlier) {
    const edge = edgeBetween(projected, candidate, authored[index])
    if (edge) return edge.action
  }
  return "Continue"
}

export function packageGraph(graph: Graph, source: FlowsFile): View {
  const validation = validateFlows(graph, source, { strict: true })
  if (validation.errors.length) throw new FlowPackagingError(validation.errors)

  const projected = projectGraph(graph)
  const migrated = migrateFlows(graph, source).flows
  const definitions = orderFlows(migrated)
  const flowById = new Map(definitions.map((flow) => [flow.id, flow]))
  const appearsIn = new Map<string, { flow: string; step: number }[]>()
  const localFlowsByGroup = new Map<string, Set<string>>()
  const diagnostics: ViewDiagnostic[] = validation.canonicalizations.map((item) => ({
    code: "canonicalized-reference",
    message: `${item.location}: ${item.from} → ${item.to}`,
  }))

  const flows: ViewFlow[] = definitions.map((definition) => {
    const context = deriveContext(projected, definition, flowById)
    const steps: ViewStep[] = []
    if (context) {
      const node = projected.nodeById.get(context.screenId)!
      steps.push({
        number: 1,
        title: screenTitle(node, projected.overrides),
        screenId: context.screenId,
        action: "Entry point",
        screenshotPath: node.screenshotPath,
        kind: "context",
        ...(context.variationIds ? { variationIds: context.variationIds } : {}),
      })
    }
    for (let index = 0; index < definition.steps.length; index++) {
      const screenId = definition.steps[index]
      const node = projected.nodeById.get(screenId)!
      const number = steps.length + 1
      steps.push({
        number,
        title: screenTitle(node, projected.overrides),
        screenId,
        action: actionFor(projected, definition.steps, index, context),
        screenshotPath: node.screenshotPath,
        kind: "screen",
      })
      const group = projected.groupOf.get(screenId)!
      const containingFlows = localFlowsByGroup.get(group) ?? new Set<string>()
      containingFlows.add(definition.id)
      localFlowsByGroup.set(group, containingFlows)
      for (const member of projected.membersByGroup.get(group) ?? [screenId]) {
        const occurrences = appearsIn.get(member) ?? []
        occurrences.push({ flow: definition.id, step: number })
        appearsIn.set(member, occurrences)
      }
    }
    const replay = buildReplay(projected, definition.steps, context?.screenId ?? null)
    if (replay.status === "unavailable") {
      diagnostics.push({
        code: "replay-unavailable",
        flowId: definition.id,
        message: replay.reason,
      })
    } else {
      for (const warning of replay.warnings ?? []) {
        diagnostics.push({
          code: "replay-incomplete-selector",
          flowId: definition.id,
          message: warning,
        })
      }
    }
    return {
      id: definition.id,
      slug: definition.id,
      name: definition.name,
      parent: definition.parentId,
      summary: definition.summary ?? "",
      entryPoints: [...(definition.entryPoints ?? [])].sort((a, b) => {
        if (a.flowId !== b.flowId) return a.flowId < b.flowId ? -1 : 1
        if (a.fromScreenId !== b.fromScreenId) return a.fromScreenId < b.fromScreenId ? -1 : 1
        return a.toScreenId < b.toScreenId ? -1 : a.toScreenId > b.toScreenId ? 1 : 0
      }),
      steps,
      replay,
    }
  })

  const flowOrder = new Map(flows.map((flow, index) => [flow.id, index]))
  // Present screens in semantic flow order. This keeps onboarding and other
  // first-run screens at the front of the Screens tab while remaining fully
  // deterministic and capture-agnostic. Variations follow their authored state
  // order; screens outside flows retain lexical order at the end.
  const screenPresentationOrder = new Map<string, number>()
  let nextScreenOrder = 0
  for (const flow of flows) {
    for (const step of flow.steps) {
      if (step.kind !== "screen") continue
      const group = projected.groupOf.get(step.screenId) ?? step.screenId
      for (const member of projected.membersByGroup.get(group) ?? [step.screenId]) {
        if (!screenPresentationOrder.has(member))
          screenPresentationOrder.set(member, nextScreenOrder++)
      }
    }
  }

  const screens: ViewScreen[] = projected.nodes.map((node) => {
    const group = projected.classify.stateGroup.get(node.id)
    const occurrences = appearsIn.get(node.id) ?? []
    occurrences.sort(
      (a, b) =>
        (flowOrder.get(a.flow) ?? 0) - (flowOrder.get(b.flow) ?? 0) ||
        a.step - b.step
    )
    return {
      id: node.id,
      title: screenTitle(node, projected.overrides),
      role: projected.overrides.screens?.[node.id]?.role ?? node.role,
      description: projected.overrides.screens?.[node.id]?.description ?? "",
      screenshotPath: node.screenshotPath,
      texts: node.texts,
      interactiveElements: node.interactiveElements,
      state: group ? projected.classify.state.get(node.id) : undefined,
      stateGroup: group,
      appearsIn: occurrences,
    }
  }).sort(
    (a, b) =>
      (screenPresentationOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (screenPresentationOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )

  const decisionPoints = projected.decisionPoints.map((point) => ({
    screenId: point.nodeId,
    options: point.options.map((option) => {
      if (!option.toNode) return { label: option.label, explored: option.explored }
      const target = projected.canonicalOf.get(option.toNode) ?? option.toNode
      const group = projected.groupOf.get(target) ?? target
      const candidates = [...(localFlowsByGroup.get(group) ?? [])].sort()
      if (candidates.length === 1) {
        return { label: option.label, explored: option.explored, flowSlug: candidates[0] }
      }
      if (candidates.length > 1) {
        diagnostics.push({
          code: "ambiguous-decision-target",
          screenId: target,
          message: `Decision target "${target}" appears in multiple flows: ${candidates.join(", ")}`,
        })
      }
      return { label: option.label, explored: option.explored }
    }),
  }))

  diagnostics.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1
    if ((a.flowId ?? "") !== (b.flowId ?? "")) return (a.flowId ?? "") < (b.flowId ?? "") ? -1 : 1
    if ((a.screenId ?? "") !== (b.screenId ?? "")) return (a.screenId ?? "") < (b.screenId ?? "") ? -1 : 1
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0
  })

  const replayAvailable = flows.filter((flow) => flow.replay.status === "available").length
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
      topLevelFlows: flows.filter((flow) => flow.parent === null).length,
      replayAvailable,
      replayUnavailable: flows.length - replayAvailable,
      coveredScreens: validation.coverage.covered.length,
      uncoveredScreens: Object.keys(validation.coverage.uncovered).length,
      unaccountedScreens: validation.coverage.unaccounted.length,
    },
    coverage: validation.coverage,
    diagnostics,
  }
}

export { buildInventory, migrateFlows, validateFlows }
export type { FlowsFile, Graph, View } from "./types.ts"
