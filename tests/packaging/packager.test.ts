import { describe, it, expect } from "vitest"
import { packageGraph } from "@/lib/packager/index.ts"
import type { Graph, GraphEdge, GraphNode, InteractiveElement, ScreenRole } from "@/lib/packager/types.ts"

function el(label: string): InteractiveElement {
  return { label, role: "button", selector: `label="${label}"` }
}
function node(id: string, role: ScreenRole, skeletonHash: string, texts: string[], elements: string[], pHash: string | null = null): GraphNode {
  return {
    id,
    fingerprint: "sha256:" + id,
    skeletonHash,
    pHash,
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
    // Same screen, different token: identical structure (skeletonHash) + near-identical
    // pixels (pHash). Production merges these on skeleton + pHash, not a ticker word list.
    node("requires-usdc-a", "modal", "sk:requsdc", ["Trading requires USDC", "Add USDC to buy VIRTUAL", "Continue"], [], "p:00ff00ff00ff00ff"),
    node("requires-usdc-b", "modal", "sk:requsdc", ["Trading requires USDC", "Add USDC to buy ETH", "Continue"], [], "p:00ff00ff00ff00ff"),
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

// Home (root + hub) with one normal branch (Send/Receive nest under it) and one
// main-nav destination (Activity), which has its own sub-screens. Activity is a peer
// section, not something "launched from Home" — so it should top-level, not nest.
function navFixture(opts: { mainNav?: string[]; overrides?: Graph["overrides"] } = {}): Graph {
  const nodes: GraphNode[] = [
    node("home", "home", "sk:home", ["Home"], ["Send", "Receive", "Activity"]),
    node("send", "form", "sk:send", ["Send"], ["Confirm"]),
    node("receive", "form", "sk:receive", ["Receive"], ["Share"]),
    node("activity", "list", "sk:activity", ["Activity"], ["Filter", "Detail"]),
    node("activity-detail", "form", "sk:actdetail", ["Transaction"], ["Repeat"]),
    node("activity-filter", "form", "sk:actfilter", ["Filter activity"], ["Apply"]),
  ]
  const edges: GraphEdge[] = [
    edge("home", "send", "Tap Send", 'id="send"', "nav", 1),
    edge("home", "receive", "Tap Receive", 'id="receive"', "nav", 2),
    edge("home", "activity", "Tap Activity tab", 'id="activity-tab"', "nav", 3),
    edge("activity", "activity-detail", "Tap a transaction", 'id="txn"', "nav", 4),
    edge("activity", "activity-filter", "Tap Filter", 'id="filter"', "nav", 5),
  ]
  return {
    meta: { schemaVersion: 2, app: { name: "Nav", slug: "nav", bundleId: "com.nav.app", platform: "ios" }, captureDate: "2026-06-05", scope: "initial", mode: "free-roam", previousCapture: null },
    root: "home",
    ...(opts.mainNav ? { mainNav: opts.mainNav } : {}),
    nodes,
    edges,
    decisionPoints: [],
    overrides: opts.overrides ?? {},
  }
}

describe("packager — main-nav destinations are top-level", () => {
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)
  const find = (view: ReturnType<typeof packageGraph>, ids: string[]) =>
    view.flows.find((f) => stepsOf(f).join(">") === ids.join(">"))

  it("without mainNav: a tab destination nests under whatever launched it (Home)", () => {
    const view = packageGraph(navFixture())
    const activity = find(view, ["home", "activity"])!
    const home = find(view, ["home"])!
    expect(activity).toBeTruthy() // Activity hangs off Home as a child
    expect(activity.parent).toBe(home.slug)
    expect(view.flows.find((f) => stepsOf(f).join(">") === "activity")).toBeUndefined()
  })

  it("with mainNav: the tab destination roots its OWN top-level subtree, not under Home", () => {
    const view = packageGraph(navFixture({ mainNav: ["home", "activity"] }))
    const home = find(view, ["home"])!
    const activity = find(view, ["activity"])!
    const send = find(view, ["home", "send"])!
    const detail = find(view, ["activity", "activity-detail"])!
    expect(home.parent).toBeNull()
    expect(activity.parent).toBeNull() // top-level, a peer of Home
    expect(send.parent).toBe(home.slug) // normal branch still nests under Home
    expect(detail.parent).toBe(activity.slug) // Activity's sub-screen nests under Activity
    // Home no longer owns Activity
    expect(view.flows.some((f) => stepsOf(f).join(">") === "home>activity")).toBe(false)
    expect(view.stats.topLevelFlows).toBe(2) // Home + Activity
  })

  it("an unknown mainNav id is ignored (no crash, no effect)", () => {
    const view = packageGraph(navFixture({ mainNav: ["home", "does-not-exist"] }))
    expect(find(view, ["home", "activity"])!.parent).toBe(find(view, ["home"])!.slug)
  })
})

describe("packager — overrides.structure (the hand lever over the tree)", () => {
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)
  const find = (view: ReturnType<typeof packageGraph>, ids: string[]) =>
    view.flows.find((f) => stepsOf(f).join(">") === ids.join(">"))

  it("parent: null pins a derived child to the root", () => {
    const base = packageGraph(navFixture())
    expect(find(base, ["home", "activity"])!.parent).not.toBeNull() // child by default
    const view = packageGraph(navFixture({ overrides: { structure: { activity: { parent: null } } } }))
    const activity = view.flows.find((f) => f.slug === find(base, ["home", "activity"])!.slug)!
    expect(activity.parent).toBeNull()
  })

  it("parent re-parents a flow explicitly", () => {
    const view = packageGraph(navFixture({ overrides: { structure: { send: { parent: "receive" } } } }))
    const send = find(view, ["home", "send"])!
    const receive = find(view, ["home", "receive"])!
    expect(send.parent).toBe(receive.slug)
  })
})

const meta = (slug: string): Graph["meta"] => ({
  schemaVersion: 2, app: { name: slug, slug, bundleId: `com.${slug}.app`, platform: "ios" },
  captureDate: "2026-06-05", scope: "initial", mode: "free-roam", previousCapture: null,
})

describe("packager — edge dedup keeps the in-place signal", () => {
  it("prefers an in-place edge over a nav duplicate with the same (from,to,action)", () => {
    // amt + amt-max share a skeleton (one family, distinct text → cluster not merge).
    // The amt→amt-max transition is recorded twice with the SAME action: nav first,
    // in-place second. The in-place must win so amt-max folds into a state toggle.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Open"]),
      node("amt", "form", "sk:amt", ["Amount", "100"], ["Max", "Send", "Edit"]),
      node("amt-max", "form", "sk:amt", ["Amount", "Max selected"], ["Send", "Edit"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "amt", "Open", 'id="open"', "nav", 1),
      edge("amt", "amt-max", "Tap Max", 'label="Max"', "nav", 2),
      edge("amt", "amt-max", "Tap Max", 'label="Max"', "in-place", 3),
    ]
    const view = packageGraph({ meta: meta("dedup"), root: "home", nodes, edges, decisionPoints: [], overrides: {} })
    const amtMax = view.screens.find((s) => s.id === "amt-max")!
    expect(amtMax.stateGroup).toBe("amt") // folded into amt's toggle group
    expect(view.flows.some((f) => f.steps.some((s) => s.screenId === "amt-max"))).toBe(false)
  })
})

describe("packager — overrides survive SAF merge", () => {
  it("applies a screen override keyed by a raw node the SAF merged away", () => {
    // dup-a and dup-b are identical → merge; dup-a (lex-smaller) is canonical. The
    // override is authored against dup-b (the merged-away id) and must still apply.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Open"]),
      node("dup-a", "modal", "sk:dup", ["Same screen"], ["Go"]),
      node("dup-b", "modal", "sk:dup", ["Same screen"], ["Go"]),
    ]
    const edges: GraphEdge[] = [edge("home", "dup-a", "Open", 'id="open"', "nav", 1)]
    const view = packageGraph({
      meta: meta("merged"), root: "home", nodes, edges, decisionPoints: [],
      overrides: { screens: { "dup-b": { title: "Custom Title", role: "settings" } } },
    })
    expect(view.screens.some((s) => s.id === "dup-b")).toBe(false) // merged away
    const canon = view.screens.find((s) => s.id === "dup-a")!
    expect(canon.title).toBe("Custom Title") // override followed the merge
    expect(canon.role).toBe("settings")
  })
})

describe("packager — reachesHub is cycle-proof", () => {
  // p and q are equidistant from welcome and point at each other — a forward cycle in
  // the continuation graph — and both reach the home hub via p→home. The old memoized
  // reachesHub could cache the cycle-guard's `false` and wrongly route q as a feature flow.
  const g: Graph = {
    meta: meta("loop"), root: "welcome", decisionPoints: [], overrides: {},
    nodes: [
      node("welcome", "auth", "sk:welcome", ["Welcome"], ["Start"]),
      node("p", "other", "sk:p", ["P"], ["ToQ", "ToHome"]),
      node("q", "other", "sk:q", ["Q"], ["ToP"]),
      node("home", "home", "sk:home", ["Home"], ["Settings"]),
    ],
    edges: [
      edge("welcome", "p", "Start", 'id="s1"', "nav", 1),
      edge("welcome", "q", "Start alt", 'id="s2"', "nav", 2),
      edge("p", "q", "P to Q", 'id="pq"', "nav", 3),
      edge("q", "p", "Q to P", 'id="qp"', "nav", 4),
      edge("p", "home", "P to Home", 'id="ph"', "nav", 5),
    ],
  }

  it("completes deterministically and reaches the hub", () => {
    const view = packageGraph(g)
    expect(JSON.stringify(packageGraph(g))).toBe(JSON.stringify(view)) // no hang, deterministic
    expect(view.flows.some((f) => f.steps[f.steps.length - 1].screenId === "home")).toBe(true)
  })

  it("does not emit the hub-reaching cycle node q as a feature flow", () => {
    const view = packageGraph(g)
    // q reaches the hub (q→p→home), so it belongs to completion routing, never a
    // standalone feature flow. The memo bug would surface q as its own flow.
    expect(view.flows.some((f) => f.steps.some((s) => s.screenId === "q"))).toBe(false)
  })
})
