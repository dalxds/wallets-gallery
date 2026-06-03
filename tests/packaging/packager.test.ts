import { describe, it, expect } from "vitest"
import { packageGraph } from "@/lib/packager/index.ts"
import type { Graph, GraphEdge, GraphNode, InteractiveElement, ScreenRole } from "@/lib/packager/types.ts"

function el(label: string): InteractiveElement {
  return { label, role: "button", selector: `label="${label}"` }
}
function node(id: string, role: ScreenRole, skeletonHash: string, texts: string[], elements: string[]): GraphNode {
  return {
    id,
    fingerprint: "sha256:" + id,
    skeletonHash,
    pHash: null,
    routeKey: null,
    role,
    screenshotPath: `assets/${id}.png`,
    snapshotPath: null,
    texts,
    interactiveElements: elements.map(el),
  }
}
function edge(from: string, to: string, action: string, selector: string | null, kind: GraphEdge["kind"], step: number): GraphEdge {
  return { from, to, action, selector, kind, observedAtStep: step }
}

// A mini-app exercising the journey model: a linear journey with a side picker,
// a branch that spawns nested sub-journeys, an in-place toggle, and a merge.
function fixture(): Graph {
  const nodes: GraphNode[] = [
    node("welcome", "auth", "sk:welcome", ["Welcome"], ["Get Started"]),
    node("home", "home", "sk:home", ["Total balance", "$10.00"], ["Deposit", "Receive", "Trade"]),
    node("deposit", "form", "sk:deposit", ["Deposit", "Amount"], ["Token", "Confirm"]),
    node("token-picker", "picker", "sk:tokpick", ["Select token", "USDC", "ETH"], ["USDC", "ETH"]),
    node("confirm", "confirmation", "sk:confirm", ["Deposit complete"], ["Done"]),
    node("receive", "other", "sk:receive", ["Receive", "Request", "Scan"], ["Request", "Scan"]),
    node("request", "form", "sk:request", ["Request a payment", "Amount"], ["Buy VIRTUAL", "Buy ETH"]),
    node("scan", "other", "sk:scan", ["Scan a QR code"], ["Flash"]),
    node("trade-funded", "form", "sk:trade", ["Trade", "50%", "Continue"], ["FiftyPct", "Continue"]),
    node("trade-funded-max", "form", "sk:trade", ["Trade", "Max", "Not enough", "Receive ETH"], ["Max", "Receive"]),
    node("requires-usdc-a", "modal", "sk:requsdc", ["Trading requires USDC", "Add USDC to buy VIRTUAL", "Continue"], []),
    node("requires-usdc-b", "modal", "sk:requsdc", ["Trading requires USDC", "Add USDC to buy ETH", "Continue"], []),
  ]
  const edges: GraphEdge[] = [
    edge("welcome", "home", "Tap Get Started", 'label="Get Started"', "nav", 1),
    edge("home", "deposit", "Tap Deposit", 'id="deposit-btn"', "nav", 2),
    edge("deposit", "token-picker", "Tap Token", 'label="Token"', "nav", 3),
    edge("token-picker", "deposit", "Pick USDC", 'label="USDC"', "nav", 4), // picker returns → side-screen
    edge("deposit", "confirm", "Tap Confirm", 'id="confirm-btn"', "nav", 5),
    edge("home", "receive", "Tap Receive", 'id="receive-btn"', "nav", 5),
    edge("receive", "request", "Tap Request", 'id="request-btn"', "nav", 6),
    edge("receive", "scan", "Tap Scan", 'id="scan-btn"', "nav", 7),
    edge("home", "trade-funded", "Tap Trade", 'id="trade-btn"', "nav", 8),
    edge("trade-funded", "trade-funded-max", "Tap Max", 'label="Max"', "in-place", 9),
    edge("request", "requires-usdc-a", "Tap Buy VIRTUAL", 'label="Buy VIRTUAL"', "overlay", 10),
    edge("request", "requires-usdc-b", "Tap Buy ETH", 'label="Buy ETH"', "overlay", 11),
  ]
  return {
    meta: { schemaVersion: 2, app: { name: "Mini", slug: "mini", bundleId: "com.mini.app", platform: "ios" }, captureDate: "2026-06-03", scope: "initial", mode: "free-roam", previousCapture: null },
    root: "welcome",
    nodes,
    edges,
    decisionPoints: [],
    overrides: { flowNames: { confirm: "Buying a token" } },
  }
}

describe("packager — journeys", () => {
  const view = packageGraph(fixture())
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)
  const byPath = (ids: string[]) => view.flows.find((f) => stepsOf(f).join(">") === ids.join(">"))
  const screenById = new Map(view.screens.map((s) => [s.id, s]))

  it("merges dynamic-data near-duplicates (requires-usdc VIRTUAL/ETH → one screen)", () => {
    expect(screenById.has("requires-usdc-a")).toBe(true)
    expect(screenById.has("requires-usdc-b")).toBe(false)
    expect(view.stats.rawNodes).toBe(12)
    expect(view.stats.screens).toBe(11)
  })

  it("a journey is a full path; side pickers/modals are NOT flows (Screens-tab only)", () => {
    const buying = byPath(["home", "deposit", "confirm"])
    expect(buying).toBeTruthy()
    // the token picker is a screen but never a flow step
    expect(screenById.has("token-picker")).toBe(true)
    expect(view.flows.some((f) => stepsOf(f).includes("token-picker"))).toBe(false)
    // the requires-usdc modals likewise never become flows
    expect(view.flows.some((f) => stepsOf(f).includes("requires-usdc-a"))).toBe(false)
  })

  it("builds a nav tree: journeys nest under the screen they launch from", () => {
    const home = byPath(["home"])! // the Home feature tree (home is a hub → its own root)
    const receive = byPath(["home", "receive"])!
    const request = byPath(["receive", "request"])!
    const scan = byPath(["receive", "scan"])!
    const buying = byPath(["home", "deposit", "confirm"])!
    expect(home.parent).toBeNull()
    // launched-from-home journeys nest under Home
    expect(receive.parent).toBe(home.slug)
    expect(buying.parent).toBe(home.slug)
    // and a branch off Receive nests another level deep
    expect(request.parent).toBe(receive.slug)
    expect(scan.parent).toBe(receive.slug)
    // entry-containment holds at every level: a child's entry is a step of its parent
    for (const [child, parent] of [[receive, home], [request, receive], [buying, home]] as const) {
      expect(stepsOf(parent)).toContain(child.entryPoints[0])
    }
  })

  it("routes an in-place variant to a state toggle, not a step", () => {
    const max = screenById.get("trade-funded-max")!
    expect(max.state).toBe("max")
    expect(max.stateGroup).toBe("trade-funded")
    expect(view.flows.some((f) => stepsOf(f).includes("trade-funded-max"))).toBe(false)
    expect(byPath(["home", "trade-funded"])).toBeTruthy()
  })

  it("applies override names and flags mechanical ones", () => {
    const buying = byPath(["home", "deposit", "confirm"])!
    expect(buying.name).toBe("Buying a token")
    expect(buying.nameSource).toBe("override")
    expect(view.namingTODO.length).toBeGreaterThan(0)
  })

  it("is deterministic (same graph → identical view)", () => {
    expect(JSON.stringify(packageGraph(fixture()))).toBe(JSON.stringify(packageGraph(fixture())))
  })
})
