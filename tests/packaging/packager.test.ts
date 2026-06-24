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

describe("packager — Stage 1: empty sections, trunk cap, naming context", () => {
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)

  // home hub (with a real feature) + two main-nav sections: `shop` is a single linear chain
  // (named for the SECTION, not its deepest screen); `vault` is a tab whose only link leads to
  // another tab — an empty section, i.e. a capture gap (warned, not shown).
  function navGraph(): Graph {
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Deposit", "Shop", "Vault"]),
      node("deposit", "form", "sk:deposit", ["Deposit"], ["Confirm"]),
      node("shop", "list", "sk:shop", ["Shop Balance"], ["Browse"]),
      node("shop-catalog", "list", "sk:cat", ["Catalog"], ["Pick"]),
      node("shop-item", "other", "sk:item", ["Item detail"], ["Buy"]),
      node("vault", "list", "sk:vault", ["Vault"], ["GoShop"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "deposit", "Tap Deposit", 'id="deposit"', "nav", 1),
      edge("home", "shop", "Tap Shop tab", 'id="shop"', "nav", 2),
      edge("home", "vault", "Tap Vault tab", 'id="vault"', "nav", 3),
      edge("shop", "shop-catalog", "Browse", 'id="browse"', "nav", 4),
      edge("shop-catalog", "shop-item", "Pick", 'id="pick"', "nav", 5),
      edge("vault", "shop", "Go to shop (another tab)", 'id="goshop"', "nav", 6),
    ]
    return { meta: meta("nav"), root: "home", mainNav: ["shop", "vault"], nodes, edges, decisionPoints: [], overrides: {} }
  }

  it("namingTODO hands the namer the whole journey (every step's id + title)", () => {
    const view = packageGraph(navGraph())
    const todo = view.namingTODO.find((t) => t.steps.some((s) => s.id === "shop-item"))!
    expect(todo).toBeTruthy()
    expect(todo.steps.map((s) => s.id)).toEqual(["shop", "shop-catalog", "shop-item"])
    expect(todo.steps[0].title).toBe("Shop Balance") // titles, not just ids, so the LLM has context
  })

  it("an empty main-nav section is reported, not rendered as a lone flow", () => {
    const view = packageGraph(navGraph())
    expect(view.uncapturedSections).toContain("vault")
    expect(view.flows.some((f) => stepsOf(f).includes("vault"))).toBe(false) // not a flow
    expect(view.screens.some((s) => s.id === "vault")).toBe(true) // still browsable as a screen
  })

  it("caps an over-long linear trunk at MAX_TRUNK and reports it", () => {
    const N = 25
    const nodes: GraphNode[] = [node("s0", "home", "sk:s0", ["S0"], ["Go"])]
    const edges: GraphEdge[] = []
    for (let i = 1; i < N; i++) {
      nodes.push(node(`s${i}`, "other", `sk:s${i}`, [`S${i}`], ["Go"]))
      edges.push(edge(`s${i - 1}`, `s${i}`, "Go", `id="g${i}"`, "nav", i))
    }
    const view = packageGraph({ meta: meta("long"), root: "s0", nodes, edges, decisionPoints: [], overrides: {} })
    expect(view.stats.truncatedFlows).toBeGreaterThan(0)
    const root = view.flows.find((f) => f.steps[0].screenId === "s0")!
    expect(root.steps.length).toBeLessThanOrEqual(20) // MAX_TRUNK
  })
})

describe("packager — Stage 2: decisionPoints drive branch order + completeness", () => {
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)

  // home (no decisionPoint) branches into settings + menu; settings has a decisionPoint whose
  // option order (s-z, s-m, s-a) is BOTH non-lexical and non-observed, so it can only win if the
  // authored order drives the tree. The walk order (#4 s-m, #5 s-z, #6 s-a) and lexical order
  // (s-a, s-m, s-z) are deliberately each a different permutation.
  function dpGraph(): Graph {
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Settings", "Menu"]),
      node("menu", "other", "sk:menu", ["Menu"], ["X"]),
      node("settings", "settings", "sk:settings", ["Settings"], ["Zed", "Mike", "Alpha"]),
      node("s-z", "other", "sk:sz", ["Zed page"], ["Z"]),
      node("s-m", "other", "sk:sm", ["Mike page"], ["M"]),
      node("s-a", "other", "sk:sa", ["Alpha page"], ["A"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "settings", "Tap Settings", 'id="settings"', "nav", 1),
      edge("home", "menu", "Tap Menu", 'id="menu"', "nav", 2),
      edge("settings", "s-m", "Tap Mike", 'id="sm"', "nav", 4),
      edge("settings", "s-z", "Tap Zed", 'id="sz"', "nav", 5),
      edge("settings", "s-a", "Tap Alpha", 'id="sa"', "nav", 6),
    ]
    const decisionPoints = [
      {
        nodeId: "settings",
        options: [
          { label: "Zed", explored: true, toNode: "s-z" },
          { label: "Mike", explored: true, toNode: "s-m" },
          { label: "Alpha", explored: true, toNode: "s-a" },
          { label: "Backup", explored: false },
          { label: "Restore", explored: false },
        ],
      },
    ]
    return { meta: meta("dp"), root: "home", nodes, edges, decisionPoints, overrides: {} }
  }

  it("orders a node's children by its decisionPoint option order, not lexically", () => {
    const view = packageGraph(dpGraph())
    const settings = view.flows.find((f) => stepsOf(f).join(">") === "home>settings")!
    const children = view.flows.filter((f) => f.parent === settings.slug).map((f) => f.steps[1].screenId)
    expect(children).toEqual(["s-z", "s-m", "s-a"]) // authored order, not lexical (a,m,z) or observed (m,z,a)
  })

  it("falls back to observed-walk order, then lexical, when there is no decisionPoint", () => {
    const view = packageGraph(dpGraph())
    const home = view.flows.find((f) => stepsOf(f).join(">") === "home")!
    const children = view.flows.filter((f) => f.parent === home.slug).map((f) => f.steps[1].screenId)
    expect(children).toEqual(["settings", "menu"]) // observed (#1 settings, #2 menu), not lexical (menu, settings)
  })

  it("surfaces every authored option — explored carry a flow, unexplored stay labeled stubs", () => {
    const view = packageGraph(dpGraph())
    const dp = view.decisionPoints.find((d) => d.screenId === "settings")!
    expect(dp.options.map((o) => o.label)).toEqual(["Zed", "Mike", "Alpha", "Backup", "Restore"]) // authored order preserved
    expect(dp.options.filter((o) => !o.explored).length).toBe(2) // both unexplored methods shown
    const backup = dp.options.find((o) => o.label === "Backup")!
    expect(backup.explored).toBe(false)
    expect(backup.flowSlug).toBeUndefined() // a stub: no captured journey behind it
    expect(dp.options.find((o) => o.label === "Zed")!.flowSlug).toBeTruthy() // explored option links its flow
  })

  it("branch ordering is input-order-independent (reversing nodes/edges keeps the flow tree)", () => {
    // The decisionPoint-driven sort must not depend on array order. (Screen display order
    // follows capture order by design and is out of scope here, so compare the flow tree
    // and decisionPoints — the surfaces this stage governs.)
    const g = dpGraph()
    const rev: Graph = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() }
    const tree = (v: ReturnType<typeof packageGraph>) =>
      JSON.stringify({ flows: v.flows, decisionPoints: v.decisionPoints })
    expect(tree(packageGraph(rev))).toBe(tree(packageGraph(g)))
  })
})
