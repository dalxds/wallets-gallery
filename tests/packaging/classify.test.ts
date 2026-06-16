import { describe, it, expect } from "vitest"
import { runSAF } from "@/lib/packager/saf.ts"
import { classify, stateLabel } from "@/lib/packager/classify.ts"
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
  return classify(saf, remapped, overrides)
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

  it("picks the forced-group default independent of node order (eponymous group id wins)", () => {
    // earn + earn-funded both auto-label "default" and are force-grouped under "earn".
    // The default must be the eponymous member regardless of input order — otherwise
    // reversing the node array flips earn <-> earn-funded and reshapes the flow tree.
    const mk = (): GraphNode[] => [
      node("earn", "sk:a", ["Earn", "Total balance"], ["Invest", "Convert"]),
      node("earn-funded", "sk:b", ["Earn", "Funded"], ["Withdraw", "Invest"]),
    ]
    const ov: Overrides = { screens: { earn: { stateGroup: "earn" }, "earn-funded": { stateGroup: "earn" } } }
    for (const nodes of [mk(), mk().reverse()]) {
      const cls = run(nodes, [], ov)
      expect(cls.defaultOf.get("earn")).toBe("earn")
      expect(cls.route.get("earn")).toBe("default")
      expect(cls.route.get("earn-funded")).toBe("toggle")
    }
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

describe("SAF — CLUSTER is a true equivalence relation (no pHash chaining)", () => {
  it("does not weld the far-apart endpoints of a within-band chain into one family", () => {
    // d(A,B)=8 and d(B,C)=8, but d(A,C)=16 (beyond any band). Distinct skeletons, so only
    // a pixel term could link them. Skeleton-only clustering keeps all three apart; the old
    // `pHash <= 14` union-find chained A-B-C into one family via (non-)transitivity.
    const withHash = (id: string, sk: string, pHash: string): GraphNode => ({ ...node(id, sk, [id], ["x"]), pHash })
    const nodes = [
      withHash("A", "sk:A", "p:0000000000000000"),
      withHash("B", "sk:B", "p:00000000000000ff"), // 8 bits from A
      withHash("C", "sk:C", "p:000000000000ffff"), // 16 from A, 8 from B
    ]
    const saf = runSAF(nodes)
    const fam = (id: string) => saf.logicalOf.get(id)
    expect(fam("A")).not.toBe(fam("C")) // endpoints never chained
    expect(new Set([fam("A"), fam("B"), fam("C")]).size).toBe(3) // distinct skeletons => 3 families
  })
})

describe("stateLabel", () => {
  const n = (texts: string[], els: string[] = []) => node("s", "sk:s", texts, els)
  it("labels genuine states from generic UI words", () => {
    expect(stateLabel(n(["No transactions yet"]))).toBe("empty")
    expect(stateLabel(n(["Nothing here"]))).toBe("empty")
    expect(stateLabel(n(["Loading…"]))).toBe("loading") // sparse: 0 interactive elements
    expect(stateLabel(n(["Something went wrong"], ["Retry"]))).toBe("error")
    expect(stateLabel(n(["Payment failed", "Try again"], ["Retry"]))).toBe("error")
    expect(stateLabel(n(["Insufficient balance", "Tap Max"], ["Max"]))).toBe("max")
  })
  it("does not over-trigger on incidental words", () => {
    expect(stateLabel(n(["Add funds with no hidden fees"], ["Add funds"]))).toBe("default") // not empty
    expect(stateLabel(n(["Amount", "Max"], ["Max", "Send", "Edit"]))).toBe("default") // Max button, no insufficiency
    expect(stateLabel(n(["Loading"], ["A", "B", "C", "D"]))).toBe("default") // "loading" on a busy screen (>3 els)
    // wallet warning copy must NOT read as an error (RX_ERROR no longer matches "unable to")
    expect(stateLabel(n(["If you lose your phrase you'll be unable to recover your account"], ["Continue"]))).toBe("default")
  })
})
