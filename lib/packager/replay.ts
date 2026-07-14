// Best-effort direct replay over authored semantic steps. Semantic validity never
// depends on replay: only direct forward edges and the recorded open/return picker
// pattern compile in v1.

import type { ReplayCommand, ViewReplay } from "./types.ts"
import { edgeBetween, type ProjectedGraph } from "./project.ts"

const rank = { high: 3, medium: 2, low: 1 } as const
type Confidence = keyof typeof rank

function worse(a: Confidence, b: Confidence): Confidence {
  return rank[a] <= rank[b] ? a : b
}

function selectorConfidence(selector: string): Confidence {
  if (selector.startsWith("id=")) return "high"
  if (selector.startsWith("label=") || selector.startsWith("role=")) return "medium"
  return "low"
}

export interface AuthoredTransition {
  index: number
  from: string
  to: string
  picker: boolean
}

function isForwardReturn(edge: ReturnType<typeof edgeBetween>): boolean {
  return edge != null && edge.kind !== "back" && edge.kind !== "in-place"
}

// Resolve the authored spine once for both replay compilation and presentation
// labels. A picker is inline only when it has a real forward return to its anchor
// and the next authored step also continues from that anchor.
export function authoredTransitions(
  projected: ProjectedGraph,
  authoredSteps: string[],
  context: string | null
): AuthoredTransition[] {
  const entry = context ?? authoredSteps[0]
  if (!entry) return []
  const transitions: AuthoredTransition[] = []
  let anchor = entry
  const start = context ? 0 : 1
  for (let index = start; index < authoredSteps.length; index++) {
    const target = authoredSteps[index]
    const next = authoredSteps[index + 1]
    const returns = edgeBetween(projected, target, anchor)
    const continuesFromAnchor = next ? edgeBetween(projected, anchor, next) : null
    const picker = isForwardReturn(returns) && continuesFromAnchor != null
    transitions.push({ index, from: anchor, to: target, picker })
    if (!picker) anchor = target
  }
  return transitions
}

export function buildReplay(
  projected: ProjectedGraph,
  authoredSteps: string[],
  context: string | null
): ViewReplay {
  const entry = context ?? authoredSteps[0]
  if (!entry) return { status: "unavailable", reason: "Flow has no replay entry" }

  const commands: ReplayCommand[] = []
  if (entry === projected.root) {
    commands.push({
      command: "open",
      positionals: [projected.graph.meta.app.bundleId],
      flags: { relaunch: true },
    })
  }
  let confidence: Confidence = "high"
  const click = (from: string, to: string): string | null => {
    const edge = edgeBetween(projected, from, to)
    if (!edge) return `No recorded transition ${from} → ${to}`
    if (!edge.selector) return `Transition ${from} → ${to} has no replay selector`
    commands.push({ command: "click", positionals: [edge.selector], flags: {} })
    confidence = worse(confidence, selectorConfidence(edge.selector))
    return null
  }

  for (const transition of authoredTransitions(projected, authoredSteps, context)) {
    const opens = edgeBetween(projected, transition.from, transition.to)
    if (!opens) {
      return {
        status: "unavailable",
        reason: `No direct recorded transition ${transition.from} → ${transition.to}`,
      }
    }

    if (transition.picker) {
      const openError = click(transition.from, transition.to)
      if (openError) return { status: "unavailable", reason: openError }
      const returnError = click(transition.to, transition.from)
      if (returnError) return { status: "unavailable", reason: returnError }
      continue
    }

    const transitionError = click(transition.from, transition.to)
    if (transitionError) return { status: "unavailable", reason: transitionError }
  }

  if (commands.length === 0)
    return { status: "unavailable", reason: "Flow compiles to no replay commands" }

  return {
    status: "available",
    commands,
    entryFingerprint: projected.nodeById.get(entry)?.fingerprint ?? "",
    confidence,
  }
}
