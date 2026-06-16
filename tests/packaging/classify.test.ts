import { describe, it, expect } from "vitest"
import { runSAF } from "@/lib/packager/saf.ts"
import { classify } from "@/lib/packager/classify.ts"
import { buildAdjacency } from "@/lib/packager/graph.ts"
import type { GraphEdge, GraphNode, InteractiveElement, Overrides, ScreenRole } from "@/lib/packager/types.ts"

const el = (label: string): InteractiveElement => ({ label, role: "button", selector: null })
function node(id: string, skeletonHash: string, texts: string[], elements: string[], role: ScreenRole = "other"): GraphNode {
  return { id, fingerprint: "sha256:" + id, skeletonHash, pHash: null, role, screenshotPath: `assets/${id}.png`, snapshotPath: null, texts, interactiveElements: elements.map(el) }
}
const edge = (from: string, to: string, kind: GraphEdge["kind"] = "nav"): GraphEdge => ({ from, to, action: "go", selector: null, kind, observedAtStep: 1 })

function run(nodes: GraphNode[], edges: GraphEdge[], overrides: Overrides = {}) {
  const saf = runSAF(nodes, overrides)
  const canon = (id: string) => saf.canonicalOf.get(id) ?? id
  const remapped = edges.map((e) => ({ ...e, from: canon(e.from), to: canon(e.to) })).filter((e) => e.from !== e.to)
  const adj = buildAdjacency(saf.canonicalNodes.map((n) => n.id), remapped)
  return classify(saf, adj, remapped, overrides)
}

describe("classify — forced stateGroup", () => {
  it("does NOT drag a skeleton-sharing family default into a forced group", () => {
    // `a` and `a2` share a skeleton → one SAF family (a2 is richer → representative).
    // The author force-groups only a + b. The earlier bug folded the family's
    // representative-default (a2) into group "g" too.
    const nodes = [
      node("a", "sk:shared", ["Earn", "Total balance"], ["Invest", "Convert"]),
      node("a2", "sk:shared", ["Token detail", "Ethereum"], ["Buy", "Sell", "Chart"]),
      node("b", "sk:other", ["Earn", "Funded"], ["Withdraw", "Invest", "Convert", "More", "Stats"]),
    ]
    const cls = run(nodes, [], { screens: { a: { stateGroup: "g" }, b: { stateGroup: "g" } } })
    expect(cls.stateGroup.get("a")).toBe("g")
    expect(cls.stateGroup.get("b")).toBe("g")
    expect(cls.stateGroup.get("a2")).toBeUndefined() // the skeleton twin stays out
  })

  it("honors an explicit state:'default' over an auto-labelled default member", () => {
    // `x` auto-labels default and sorts first; `y` is the author-tagged default.
    const nodes = [
      node("x", "sk:x", ["Plain screen"], ["Ok"]),
      node("y", "sk:y", ["Another plain screen"], ["Ok"]),
    ]
    const cls = run(nodes, [], { screens: { x: { stateGroup: "g" }, y: { stateGroup: "g", state: "default" } } })
    expect(cls.defaultOf.get("g")).toBe("y")
    expect(cls.route.get("y")).toBe("default")
    expect(cls.route.get("x")).toBe("toggle")
  })
})

describe("classify — family default fallback", () => {
  it("labels the crowned representative-default 'default' even when its own text read as an error", () => {
    // Both members read as "error", so there is no single labelled default; the
    // representative (e2, richer) is crowned default and must be surfaced as such,
    // not tagged "error" in the switcher.
    const nodes = [
      node("e1", "sk:e", ["Something went wrong"], ["Retry"]),
      node("e2", "sk:e", ["Please try again later"], ["Retry", "Back", "Home"]),
    ]
    const cls = run(nodes, [edge("e1", "e2", "in-place")])
    expect(cls.state.get("e2")).toBe("default") // crowned default
    expect(cls.state.get("e1")).toBe("error") // the variant keeps its real label
  })
})
