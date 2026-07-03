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
    // flowNames is keyed by the flow's NAME KEY — its first distinctive screen (steps[1]),
    // not its goal/last screen. The buying flow is home → deposit → confirm, so its key is
    // `deposit` (decoupled from the routing slug; shared across cross-section copies).
    overrides: { flowNames: { deposit: "Buying a token" } },
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

  it("weaves a return-to-launcher picker inline as a kind:'picker' step (trunk intact)", () => {
    // token-picker pops back to its launcher (deposit). It is woven into the buying trunk right
    // after deposit, as a picker step — the spine then continues from deposit's forward exit
    // (confirm). The trunk is not shattered, and the picker is not its own flow.
    const buying = byPath(["home", "deposit", "token-picker", "confirm"])
    expect(buying).toBeTruthy()
    const picker = buying!.steps.find((s) => s.screenId === "token-picker")!
    expect(picker.kind).toBe("picker")
    expect(buying!.steps.map((s) => s.kind)).toEqual(["forward", "forward", "picker", "forward"])
    // the picker is never its own flow root
    expect(view.flows.some((f) => f.steps[0].screenId === "token-picker")).toBe(false)
    // a forward-only sheet with no return (the "requires USDC" modal) is an ordinary step
    expect(view.flows.some((f) => stepsOf(f).includes("requires-usdc-a"))).toBe(true)
    const reqStep = view.flows.flatMap((f) => f.steps).find((s) => s.screenId === "requires-usdc-a")!
    expect(reqStep.kind).toBe("forward")
  })

  it("builds a nav tree: journeys nest under the screen they launch from", () => {
    const home = byPath(["home"])! // the Home feature tree (home is a hub → its own root)
    const receive = byPath(["home", "receive"])!
    // request's trunk now runs through the "requires USDC" sheet (a dominated leaf step).
    const request = byPath(["receive", "request", "requires-usdc-a"])!
    const scan = byPath(["receive", "scan"])!
    const buying = byPath(["home", "deposit", "token-picker", "confirm"])! // picker woven inline
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
    const buying = byPath(["home", "deposit", "token-picker", "confirm"])!
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

  it("dedup survivor + parallel-edge selection are input-order-independent (edge reversal is byte-identical)", () => {
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Send", "Settings"]),
      node("send", "form", "sk:send", ["Send money", "Amount"], ["Continue"]),
      node("settings", "settings", "sk:set", ["Settings"], ["Sign out"]),
    ]
    const edges: GraphEdge[] = [
      // (a) two same-(from,to,action) edges differing only in observedAtStep/selector —
      // the survivor must be the earliest-observed one, not whichever came first in the array.
      edge("home", "settings", "Open settings", 'id="settings-late"', "nav", 6),
      edge("home", "settings", "Open settings", 'id="settings-early"', "nav", 2),
      // (b) two parallel edges (same pair, different action) — edgeBetween must pick the
      // earliest-observed action, not the first in the array.
      edge("home", "send", "Tap Send", 'id="send"', "nav", 3),
      edge("home", "send", "Tap avatar", 'id="avatar"', "nav", 4),
    ]
    const g: Graph = { meta: meta("edgerev"), root: "home", nodes, edges, decisionPoints: [], overrides: {} }
    // Reverse EDGES only — node order legitimately governs screen display order, so hold it fixed.
    const rev: Graph = { ...g, edges: [...g.edges].reverse() }
    const fwd = packageGraph(g)
    expect(JSON.stringify(packageGraph(rev))).toBe(JSON.stringify(fwd)) // flows, steps, replay all identical
    // and the choice is the EARLIEST-observed one, not merely stable:
    const s = JSON.stringify(fwd)
    expect(s).toContain("settings-early")
    expect(s).not.toContain("settings-late")
    expect(s).toContain("Tap Send")
    expect(s).not.toContain("Tap avatar")
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

describe("packager — the dominator tree is cycle-proof", () => {
  // p and q point at each other — a forward cycle in the nav subgraph — and both hang off
  // welcome; p also leads to the home hub. The iterative dominator fixpoint must terminate and
  // be deterministic on the cycle, and the tree must not duplicate the cycle into an infinite
  // nest. (idom(p)=idom(q)=welcome, so welcome is a hub with p and q as siblings.)
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

  it("terminates deterministically on the cycle", () => {
    const view = packageGraph(g)
    expect(JSON.stringify(packageGraph(g))).toBe(JSON.stringify(view)) // no hang, deterministic
  })

  it("nests the cycle nodes under their common dominator without looping", () => {
    const view = packageGraph(g)
    const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)
    const welcome = view.flows.find((f) => stepsOf(f).join(">") === "welcome")!
    const p = view.flows.find((f) => stepsOf(f).join(">") === "welcome>p")!
    const q = view.flows.find((f) => stepsOf(f).join(">") === "welcome>q")!
    expect(p.parent).toBe(welcome.slug) // welcome dominates p and q → it's their hub
    expect(q.parent).toBe(welcome.slug)
    // home is its own anchor (idom = super-source via the home role), never nested under p
    expect(view.flows.some((f) => f.parent === p.slug)).toBe(false)
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

describe("packager — top-level anchor order is input-order-independent", () => {
  // Two home-role hubs (homeX/homeY) and two indeg-0 orphans exercise both anchor sources;
  // homeX→addX and homeY→addY are both named "Add money", forcing add-money / add-money-2
  // disambiguation. Reversing graph.nodes must NOT swap which copy owns which slug (the
  // published /flow/add-money URL would otherwise open the other cross-section copy).
  function multiAnchor(): Graph {
    const nodes: GraphNode[] = [
      node("start", "auth", "sk:start", ["Welcome"], ["Go"]),
      node("homeX", "home", "sk:hx", ["Home X", "Balance"], ["Add money"]),
      node("homeY", "home", "sk:hy", ["Home Y", "Balance"], ["Add money"]),
      node("addX", "form", "sk:addx", ["Add money", "Amount"], ["Confirm"]),
      node("addY", "form", "sk:addy", ["Add money", "Amount"], ["Confirm"]),
      node("orphanA", "other", "sk:oa", ["Orphan A"], ["X"]),
      node("orphanB", "other", "sk:ob", ["Orphan B"], ["Y"]),
    ]
    const edges: GraphEdge[] = [
      edge("start", "homeX", "Go X", 'id="gx"', "nav", 1),
      edge("start", "homeY", "Go Y", 'id="gy"', "nav", 2),
      edge("homeX", "addX", "Add money", 'id="ax"', "nav", 3),
      edge("homeY", "addY", "Add money", 'id="ay"', "nav", 4),
    ]
    return { meta: meta("anchors"), root: "start", nodes, edges, decisionPoints: [], overrides: {} }
  }
  const g = multiAnchor()
  const fwd = packageGraph(g)
  const tree = (v: ReturnType<typeof packageGraph>) => JSON.stringify({ flows: v.flows, decisionPoints: v.decisionPoints })

  it("reversing nodes/edges keeps the flow tree and the -2 slug assignment", () => {
    const rev: Graph = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() }
    expect(tree(packageGraph(rev))).toBe(tree(fwd))
  })

  it("really does force same-named-flow disambiguation (add-money / add-money-2)", () => {
    const stepsBySlug = (slug: string) => fwd.flows.find((f) => f.slug === slug)?.steps.map((s) => s.screenId)
    expect(stepsBySlug("add-money")).toEqual(["homeX", "addX"])
    expect(stepsBySlug("add-money-2")).toEqual(["homeY", "addY"])
  })
})

describe("packager — Stage 4: the dominator tree is the flow tree", () => {
  const stepsOf = (f: { steps: { screenId: string }[] }) => f.steps.map((s) => s.screenId)
  const byPath = (v: ReturnType<typeof packageGraph>, ids: string[]) =>
    v.flows.find((f) => stepsOf(f).join(">") === ids.join(">"))

  it("keeps a forward trunk that exits to a sheet shared with another flow (no mis-drop)", () => {
    // The avici buy-review bug, distilled: home branches into a deep Buy trunk and a shallow
    // Swap. Buy's last screen (review) exits ONLY to an execute sheet that Swap also reaches.
    // The old BFS-distance proxy saw that cheap shared sheet and cut the trunk at buy-amount;
    // the dominator tree keeps review (only buy-amount reaches it) and lands the shared sheet at
    // the common dominator (home), emitted ONCE — never duplicated into both trunks.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Buy", "Swap"]),
      node("buy-detail", "other", "sk:bd", ["SpaceX"], ["Buy"]),
      node("buy-amount", "form", "sk:ba", ["Amount"], ["Review"]),
      node("buy-review", "confirmation", "sk:br", ["Review order"], ["Slide to buy"]),
      node("swap", "form", "sk:sw", ["Swap"], ["Slide to swap"]),
      node("execute", "modal", "sk:ex", ["High price impact"], ["Confirm"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "buy-detail", "Tap an asset", 'id="asset"', "overlay", 1),
      edge("buy-detail", "buy-amount", "Tap Buy", 'id="buy"', "overlay", 2),
      edge("buy-amount", "buy-review", "Tap Review", 'id="review"', "nav", 3),
      edge("buy-review", "execute", "Slide to buy", 'id="slide-buy"', "overlay", 4),
      edge("home", "swap", "Open swap", 'id="swap"', "nav", 5),
      edge("swap", "execute", "Slide to swap", 'id="slide-swap"', "overlay", 6),
      edge("execute", "home", "Confirm → returns home", 'id="confirm"', "nav", 7),
    ]
    const view = packageGraph({ meta: meta("conv"), root: "home", nodes, edges, decisionPoints: [], overrides: {} })
    // the Buy trunk reaches review (the mis-drop is fixed)
    expect(byPath(view, ["home", "buy-detail", "buy-amount", "buy-review"])).toBeTruthy()
    const review = view.screens.find((s) => s.id === "buy-review")!
    expect(review.appearsIn.length).toBeGreaterThan(0)
    // the shared execute sheet lands at the common dominator (home), as a single leaf — it is
    // NOT swallowed into the Buy or Swap trunk, and NOT duplicated.
    expect(byPath(view, ["home", "execute"])).toBeTruthy()
    expect(view.flows.filter((f) => stepsOf(f).includes("execute")).length).toBe(1)
    expect(byPath(view, ["home", "buy-detail", "buy-amount", "buy-review"])!.steps.some((s) => s.screenId === "execute")).toBe(false)
    expect(byPath(view, ["home", "swap"])!.steps.some((s) => s.screenId === "execute")).toBe(false)
  })

  it("re-emits a cross-section journey under each section, sharing one authored name", () => {
    // add-money is reachable from both Home and the Earn section. The dominator tree's common
    // dominator is the super-source, but we keep a copy under EACH reaching section (locked
    // decision) — with a unique routing slug but ONE name key (steps[1] = add-money), so the
    // name is authored once.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Earn", "Add money"]),
      node("earn", "list", "sk:earn", ["Earn"], ["Add money"]),
      node("add-money", "form", "sk:am", ["Add money"], ["Bank", "Card"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "earn", "Tap Earn tab", 'id="earn"', "nav", 1),
      edge("home", "add-money", "Tap Add money", 'id="add-home"', "nav", 2),
      edge("earn", "add-money", "Tap Add money", 'id="add-earn"', "nav", 3),
    ]
    const view = packageGraph({
      meta: meta("xsec"), root: "home", mainNav: ["earn"], nodes, edges, decisionPoints: [],
      overrides: { flowNames: { "add-money": "Adding money" } },
    })
    const fromHome = byPath(view, ["home", "add-money"])!
    const fromEarn = byPath(view, ["earn", "add-money"])!
    expect(fromHome).toBeTruthy()
    expect(fromEarn).toBeTruthy()
    expect(fromHome.name).toBe("Adding money") // authored once by name key, both copies inherit it
    expect(fromEarn.name).toBe("Adding money")
    expect(fromHome.slug).not.toBe(fromEarn.slug) // but each keeps a unique route
    expect(fromHome.nameSource).toBe("override")
    expect(fromEarn.nameSource).toBe("override")
  })

  it("weaves a return-to-launcher excursion inline without shattering a linear trunk", () => {
    // s2 opens a picker that pops straight back to s2. Naively the dominator tree would make s2 a
    // hub (picker + s3) and split the onboarding; instead the picker is woven inline after s2 and
    // the spine continues to s3 — one trunk, the picker a kind:"picker" step, never its own flow.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Go"]),
      node("s1", "form", "sk:s1", ["Step 1"], ["Next"]),
      node("s2", "form", "sk:s2", ["Step 2", "Country"], ["Pick country", "Next"]),
      node("picker", "picker", "sk:pick", ["Select country", "US", "CA"], ["US", "CA"]),
      node("s3", "form", "sk:s3", ["Step 3"], ["Done"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "s1", "Start", 'id="start"', "nav", 1),
      edge("s1", "s2", "Next", 'id="n1"', "nav", 2),
      edge("s2", "picker", "Pick country", 'id="pick"', "overlay", 3),
      edge("picker", "s2", "Select US", 'id="us"', "nav", 4),
      edge("s2", "s3", "Next", 'id="n2"', "nav", 5),
    ]
    const view = packageGraph({ meta: meta("exc"), root: "home", nodes, edges, decisionPoints: [], overrides: {} })
    const trunk = byPath(view, ["home", "s1", "s2", "picker", "s3"])! // picker woven, trunk intact
    expect(trunk).toBeTruthy()
    expect(trunk.steps.find((s) => s.screenId === "picker")!.kind).toBe("picker")
    expect(trunk.steps.find((s) => s.screenId === "s3")!.kind).toBe("forward") // spine continues from s2
    expect(view.flows.some((f) => f.steps[0].screenId === "picker")).toBe(false) // never its own flow
    // replay opens the picker (s2→picker) and selects back (picker→s2) before continuing to s3
    const clicks = trunk.replay!.commands.filter((c) => c.command === "click").map((c) => c.positionals[0])
    expect(clicks).toEqual(['id="start"', 'id="n1"', 'id="pick"', 'id="us"', 'id="n2"'])
  })

  it("collapses a homogeneous detail fan-out to one exemplar (no N flows for N instances)", () => {
    // A hub whose rows all open the SAME logical detail screen (one SAF family) — tapping any
    // asset opens an identical detail. They are instances of one pattern, not N journeys: keep
    // one exemplar flow, drop the rest (still browsable as screens).
    const nodes: GraphNode[] = [
      node("markets", "list", "sk:markets", ["Markets"], ["A", "B", "C"]),
      node("asset-a", "other", "sk:asset", ["Asset A detail"], ["Buy"]),
      node("asset-b", "other", "sk:asset", ["Asset B detail"], ["Buy"]),
      node("asset-c", "other", "sk:asset", ["Asset C detail"], ["Buy"]),
    ]
    const edges: GraphEdge[] = [
      edge("markets", "asset-a", "Tap asset A", 'id="a"', "overlay", 1),
      edge("markets", "asset-b", "Tap asset B", 'id="b"', "overlay", 2),
      edge("markets", "asset-c", "Tap asset C", 'id="c"', "overlay", 3),
    ]
    const view = packageGraph({ meta: meta("fan"), root: "markets", nodes, edges, decisionPoints: [], overrides: {} })
    const detailFlows = view.flows.filter((f) => ["asset-a", "asset-b", "asset-c"].includes(f.steps[f.steps.length - 1].screenId))
    expect(detailFlows.length).toBe(1) // one exemplar, not three
    // all three remain browsable as screens
    for (const id of ["asset-a", "asset-b", "asset-c"]) expect(view.screens.some((s) => s.id === id)).toBe(true)
  })
})

describe("packager — excursions launched from a top-level flow's first step", () => {
  const stepsOf = (f: { steps: { screenId: string; kind: string }[] }) => f.steps.map((s) => `${s.screenId}(${s.kind})`)

  it("weaves an excursion launched from a top-level LINEAR trunk's first step (idx 0)", () => {
    // home has one onward chain (send → confirm) and a picker sheet that pops back to home.
    // home sits at steps[0] of its own multi-step top-level trunk, so the old `idx >= 1` guard
    // skipped weaving there and the picker vanished from every flow (appearsIn: []).
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Send", "Pick"]),
      node("send", "form", "sk:send", ["Send", "Amount"], ["Confirm"]),
      node("confirm", "confirmation", "sk:confirm", ["Sent"], ["Done"]),
      node("picker", "picker", "sk:pick", ["Choose account", "Acct A", "Acct B"], ["Acct A", "Acct B"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "send", "Tap Send", 'id="send"', "nav", 1),
      edge("send", "confirm", "Tap Confirm", 'id="confirm"', "nav", 2),
      edge("home", "picker", "Tap Pick", 'id="pick"', "nav", 3),
      edge("picker", "home", "Pick Acct A", 'label="Acct A"', "nav", 4), // pops back → excursion off home
    ]
    const view = packageGraph({ meta: meta("weave"), root: "home", nodes, edges, decisionPoints: [], overrides: {} })
    const trunk = view.flows.find((f) => f.steps.some((s) => s.screenId === "send"))!
    // picker woven as a picker step immediately after home
    expect(stepsOf(trunk).slice(0, 2)).toEqual(["home(forward)", "picker(picker)"])
    // the picker screen is findable in a flow again
    expect(view.screens.find((s) => s.id === "picker")!.appearsIn.length).toBeGreaterThan(0)
    // and exactly once across all flows
    expect(view.flows.flatMap((f) => f.steps).filter((s) => s.screenId === "picker").length).toBe(1)
  })

  it("does not double-weave a hub anchor's excursion into its child flows", () => {
    // home is a hub (send → confirm and receive) launching a picker excursion. The picker must
    // appear only in home's own flow — child flows borrow home as steps[0] (parent !== null) and
    // must skip weaving there.
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Send", "Receive", "Pick"]),
      node("send", "form", "sk:send", ["Send", "Amount"], ["Confirm"]),
      node("confirm", "confirmation", "sk:confirm", ["Sent"], ["Done"]),
      node("receive", "other", "sk:recv", ["Receive", "QR"], ["Share"]),
      node("picker", "picker", "sk:pick", ["Choose account", "Acct A"], ["Acct A"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "send", "Tap Send", 'id="send"', "nav", 1),
      edge("send", "confirm", "Tap Confirm", 'id="confirm"', "nav", 2),
      edge("home", "receive", "Tap Receive", 'id="recv"', "nav", 3),
      edge("home", "picker", "Tap Pick", 'id="pick"', "nav", 4),
      edge("picker", "home", "Pick Acct A", 'label="Acct A"', "nav", 5),
    ]
    const view = packageGraph({ meta: meta("hub"), root: "home", nodes, edges, decisionPoints: [], overrides: {} })
    const hub = view.flows.find((f) => f.parent === null)!
    expect(hub.steps.some((s) => s.screenId === "picker" && s.kind === "picker")).toBe(true)
    // picker appears once total — not duplicated into the send / receive child flows
    expect(view.flows.flatMap((f) => f.steps).filter((s) => s.screenId === "picker").length).toBe(1)
  })
})

describe("packager — cross-family in-place edges stay in the flow tree", () => {
  // A and B share a coarse skeleton; assemble.ts forced the A→B nav to kind:"in-place" and the
  // agent pinned B distinct via overrides.splits. B is then a singleton family, classify folds
  // nothing, and the old subgraph (nav/overlay only) dropped the in-place edge — B and everything
  // reachable through it (C) vanished from every flow while still counting for in-degree.
  function splitGraph(): Graph {
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["Open"]),
      node("A", "form", "sk:shared", ["Screen A", "Alpha"], ["Next"]),
      node("B", "form", "sk:shared", ["Screen B", "Beta"], ["More"]),
      node("C", "confirmation", "sk:c", ["Done screen"], ["Finish"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "A", "Open", 'id="open"', "nav", 1),
      edge("A", "B", "Go B", 'id="gob"', "in-place", 2), // cross-family in-place (forced from a coarse-skeleton nav)
      edge("B", "C", "Go C", 'id="goc"', "nav", 3),
    ]
    return { meta: meta("split"), root: "home", nodes, edges, decisionPoints: [], overrides: { splits: ["B"] } }
  }

  it("keeps B (and C reachable through it) in the flow tree", () => {
    const view = packageGraph(splitGraph())
    const stepIds = view.flows.flatMap((f) => f.steps.map((s) => s.screenId))
    expect(stepIds).toContain("B")
    expect(stepIds).toContain("C")
    expect(view.screens.find((s) => s.id === "B")!.appearsIn.length).toBeGreaterThan(0)
    expect(view.screens.find((s) => s.id === "C")!.appearsIn.length).toBeGreaterThan(0)
  })

  it("is input-order-independent (reversing nodes/edges keeps the flow tree)", () => {
    const g = splitGraph()
    const rev: Graph = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() }
    const tree = (v: ReturnType<typeof packageGraph>) => JSON.stringify({ flows: v.flows, decisionPoints: v.decisionPoints })
    expect(tree(packageGraph(rev))).toBe(tree(packageGraph(g)))
  })
})

describe("packager — overrides.structure parent cycles are broken deterministically", () => {
  // home launches independent alpha (a1→a2), beta (b1→b2), gamma (c1→c2) flows; their STABLE
  // flow ids are the goal screens a2/b2/c2, which overrides.structure keys against.
  function cycleGraph(structure: Record<string, { parent?: string | null }>): Graph {
    const nodes: GraphNode[] = [
      node("home", "home", "sk:home", ["Home"], ["A", "B", "C"]),
      node("a1", "form", "sk:a1", ["Alpha start"], ["Go"]),
      node("a2", "confirmation", "sk:a2", ["Alpha done"], ["Fin"]),
      node("b1", "form", "sk:b1", ["Beta start"], ["Go"]),
      node("b2", "confirmation", "sk:b2", ["Beta done"], ["Fin"]),
      node("c1", "form", "sk:c1", ["Gamma start"], ["Go"]),
      node("c2", "confirmation", "sk:c2", ["Gamma done"], ["Fin"]),
    ]
    const edges: GraphEdge[] = [
      edge("home", "a1", "A", 'id="a"', "nav", 1), edge("a1", "a2", "Go", 'id="ga"', "nav", 2),
      edge("home", "b1", "B", 'id="b"', "nav", 3), edge("b1", "b2", "Go", 'id="gb"', "nav", 4),
      edge("home", "c1", "C", 'id="c"', "nav", 5), edge("c1", "c2", "Go", 'id="gc"', "nav", 6),
    ]
    return { meta: meta("cyc"), root: "home", nodes, edges, decisionPoints: [], overrides: { structure } }
  }
  const treeOf = (v: ReturnType<typeof packageGraph>) => v.flows.map((f) => `${f.slug}:${f.parent}`).sort().join("|")

  it("breaks a 2-flow cycle: both flows kept, exactly one re-rooted to null, deterministically", () => {
    const g = cycleGraph({ a2: { parent: "b2" }, b2: { parent: "a2" } })
    const v = packageGraph(g)
    const cyc = v.flows.filter((f) => ["alpha-start", "beta-start"].includes(f.slug))
    expect(cyc.length).toBe(2) // both present — neither hidden by the cycle
    expect(cyc.filter((f) => f.parent === null).length).toBe(1) // exactly one broken to root
    // stable under nodes/edges reversal AND under swapping the two structure entries' key order
    const rev = packageGraph({ ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() })
    const swap = packageGraph(cycleGraph({ b2: { parent: "a2" }, a2: { parent: "b2" } }))
    expect(treeOf(rev)).toBe(treeOf(v))
    expect(treeOf(swap)).toBe(treeOf(v))
  })

  it("breaks a 3-flow cycle at exactly one member, preserving the rest of the chain", () => {
    const v = packageGraph(cycleGraph({ a2: { parent: "b2" }, b2: { parent: "c2" }, c2: { parent: "a2" } }))
    const cyc = v.flows.filter((f) => ["alpha-start", "beta-start", "gamma-start"].includes(f.slug))
    expect(cyc.length).toBe(3) // all three kept
    expect(cyc.filter((f) => f.parent === null).length).toBe(1) // one deterministic break, chain otherwise intact
  })

  it("a dangling structure parent falls back to top-level (no cycle, no loss)", () => {
    const v = packageGraph(cycleGraph({ a2: { parent: "does-not-exist" } }))
    expect(v.flows.find((f) => f.slug === "alpha-start")!.parent).toBeNull()
  })
})
