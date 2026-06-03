// Inline .ad replay generation from a journey's trunk edges.
import type { GraphEdge, GraphNode, ReplayCommand, ViewReplay } from "./types.ts"

const rank = { high: 3, medium: 2, low: 1 } as const
type Conf = keyof typeof rank
const worse = (a: Conf, b: Conf): Conf => (rank[a] <= rank[b] ? a : b)

function selectorConfidence(selector: string): Conf {
  if (selector.startsWith("id=")) return "high"
  if (selector.startsWith("label=") || selector.startsWith("role=")) return "medium"
  return "low"
}

export function buildReplay(
  entry: string,
  steps: string[],
  nodeById: Map<string, GraphNode>,
  edgeBetween: (a: string, b: string) => GraphEdge | null,
  bundleId: string,
  rootId: string
): ViewReplay | null {
  const commands: ReplayCommand[] = []
  if (entry === rootId) {
    commands.push({ command: "open", positionals: [bundleId], flags: { relaunch: true } })
  }

  let confidence: Conf = "high"
  let missing = false
  for (let i = 1; i < steps.length; i++) {
    const e = edgeBetween(steps[i - 1], steps[i])
    if (!e || !e.selector) {
      missing = true
      continue
    }
    commands.push({ command: "click", positionals: [e.selector], flags: {} })
    confidence = worse(confidence, selectorConfidence(e.selector))
  }

  if (commands.length === 0) return null
  const entryNode = nodeById.get(entry)
  return {
    commands,
    entryFingerprint: entryNode?.fingerprint ?? "",
    confidence: missing ? "low" : confidence,
    credentialsTemplate: [],
  }
}
