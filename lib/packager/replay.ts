// Inline .ad replay generation from a journey's woven step plan.
import type { GraphEdge, GraphNode, ReplayCommand, ViewReplay } from "./types.ts"

const rank = { high: 3, medium: 2, low: 1 } as const
type Conf = keyof typeof rank
const worse = (a: Conf, b: Conf): Conf => (rank[a] <= rank[b] ? a : b)

function selectorConfidence(selector: string): Conf {
  if (selector.startsWith("id=")) return "high"
  if (selector.startsWith("label=") || selector.startsWith("role=")) return "medium"
  return "low"
}

// One woven step: a forward spine step (`from` is the previous trunk node), an entry step
// (`from` is null → no click), or a picker excursion (`from` is the launcher — replay opens the
// picker from the launcher, makes the selection that returns to it, then the next forward step
// continues from the launcher).
export interface ReplayStep {
  node: string
  kind: "forward" | "picker"
  from: string | null
}

export function buildReplay(
  entry: string,
  plan: ReplayStep[],
  edgeBetween: (a: string, b: string) => GraphEdge | null,
  nodeById: Map<string, GraphNode>,
  bundleId: string,
  rootId: string
): ViewReplay | null {
  const commands: ReplayCommand[] = []
  if (entry === rootId) {
    commands.push({ command: "open", positionals: [bundleId], flags: { relaunch: true } })
  }

  let confidence: Conf = "high"
  let missing = false
  const click = (e: GraphEdge | null) => {
    if (!e || !e.selector) { missing = true; return }
    commands.push({ command: "click", positionals: [e.selector], flags: {} })
    confidence = worse(confidence, selectorConfidence(e.selector))
  }
  for (const p of plan) {
    if (p.from === null) continue // entry step — already on screen
    if (p.kind === "picker") {
      click(edgeBetween(p.from, p.node)) // open the picker from its launcher
      click(edgeBetween(p.node, p.from)) // make the selection that returns to the launcher
    } else {
      click(edgeBetween(p.from, p.node))
    }
  }

  if (commands.length === 0) return null
  const entryNode = nodeById.get(entry)
  return {
    commands,
    entryFingerprint: entryNode?.fingerprint ?? "",
    confidence: missing ? "low" : confidence,
  }
}
