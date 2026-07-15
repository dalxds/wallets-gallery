import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { packageGraph } from "@/lib/packager/index.ts"
import {
  auditFlowPackages,
  migrateFlows,
  validateFlows,
} from "@/lib/packager/flows.ts"
import { buildInventory } from "@/lib/packager/project.ts"
import { validateGraph } from "@/lib/packager/validate.ts"
import type {
  DecisionPoint,
  FlowsFile,
  Graph,
  GraphEdge,
  GraphNode,
  InteractiveElement,
  Overrides,
  ScreenRole,
} from "@/lib/packager/types.ts"

function element(
  label: string,
  selector: string | null = `label="${label}"`
): InteractiveElement {
  return { label, role: "button", selector }
}

function node(
  id: string,
  role: ScreenRole = "other",
  options: Partial<GraphNode> = {}
): GraphNode {
  return {
    id,
    fingerprint: `sha256:${id}`,
    skeletonHash: `sk:${id}`,
    pHash: null,
    role,
    screenshotPath: `assets/${id}.png`,
    snapshotPath: null,
    texts: [id],
    interactiveElements: [element(id)],
    ...options,
  }
}

function edge(
  from: string,
  to: string,
  selector: string | null = `id="${from}-${to}"`,
  kind: GraphEdge["kind"] = "nav",
  observedAtStep = 1
): GraphEdge {
  return { from, to, action: `Go ${to}`, selector, kind, observedAtStep }
}

function graph(
  nodes: GraphNode[],
  edges: GraphEdge[] = [],
  options: {
    root?: string
    overrides?: Overrides
    decisionPoints?: DecisionPoint[]
    mainNav?: string[]
  } = {}
): Graph {
  return {
    meta: {
      schemaVersion: 2,
      app: {
        name: "Demo",
        slug: "demo",
        bundleId: "com.demo",
        platform: "android",
      },
      captureDate: "2026-07-14",
      scope: "initial",
      mode: "guided",
      previousCapture: null,
    },
    root: options.root ?? nodes[0].id,
    ...(options.mainNav ? { mainNav: options.mainNav } : {}),
    nodes,
    edges,
    decisionPoints: options.decisionPoints ?? [],
    overrides: options.overrides ?? {},
  }
}

function flows(
  definitions: FlowsFile["flows"],
  uncovered: Record<string, string> = {}
): FlowsFile {
  return { schemaVersion: 1, flows: definitions, uncovered, flowTODO: [] }
}

describe("semantic flow validation and tree", () => {
  it("keeps useful one-screen flows and resolves deep semantic parents without graph junctions", () => {
    const g = graph([
      node("home", "home"),
      node("settings", "settings"),
      node("security", "settings"),
      node("password", "form"),
    ])
    const source = flows([
      { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
      {
        id: "managing-settings",
        name: "Managing settings",
        parentId: "home",
        order: 0,
        steps: ["settings"],
      },
      {
        id: "managing-security",
        name: "Managing security",
        parentId: "managing-settings",
        order: 0,
        steps: ["security"],
      },
      {
        id: "changing-password",
        name: "Changing password",
        parentId: "managing-security",
        order: 0,
        steps: ["password"],
      },
    ])
    const view = packageGraph(g, source)
    expect(view.flows.map((flow) => flow.id)).toEqual([
      "home",
      "managing-settings",
      "managing-security",
      "changing-password",
    ])
    expect(view.flows.every((flow) => flow.steps.length === 1)).toBe(true)
    expect(
      view.flows.find((flow) => flow.id === "changing-password")?.parent
    ).toBe("managing-security")
  })

  it("renders alternate entries as metadata without duplicate tree nodes", () => {
    const g = graph([
      node("home", "home"),
      node("earn", "list"),
      node("add", "picker"),
    ])
    const view = packageGraph(
      g,
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "adding-money",
          name: "Adding money",
          parentId: "home",
          order: 0,
          steps: ["add"],
          entryPoints: [
            {
              flowId: "earn",
              fromScreenId: "earn",
              toScreenId: "add",
            },
          ],
        },
        { id: "earn", name: "Earn", parentId: null, order: 1, steps: ["earn"] },
      ])
    )
    expect(
      view.flows.filter((flow) => flow.id === "adding-money")
    ).toHaveLength(1)
    expect(
      view.flows.find((flow) => flow.id === "adding-money")?.entryPoints
    ).toEqual([{ flowId: "earn", fromScreenId: "earn", toScreenId: "add" }])
  })

  it("rejects cycles, dangling references, TODOs in strict mode, and unaccounted screens", () => {
    const g = graph([node("home"), node("lost")])
    const source: FlowsFile = {
      schemaVersion: 1,
      flows: [
        { id: "a", name: "A", parentId: "b", order: 0, steps: ["home"] },
        { id: "b", name: "B", parentId: "a", order: 0, steps: ["missing"] },
      ],
      uncovered: {},
      flowTODO: [{ about: "a", question: "Where should this go?" }],
    }
    const result = validateFlows(g, source, { strict: true })
    expect(result.errors.some((error) => error.includes("parent cycle"))).toBe(
      true
    )
    expect(
      result.errors.some((error) => error.includes('no screen named "missing"'))
    ).toBe(true)
    expect(
      result.errors.some((error) =>
        error.includes('screen "lost" is unaccounted')
      )
    ).toBe(true)
    expect(
      result.errors.some((error) => error.includes("flowTODO must be empty"))
    ).toBe(true)
  })

  it("advises flattening a single-child wrapper", () => {
    const g = graph([node("home"), node("send")])
    const result = validateFlows(
      g,
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "sending",
          name: "Sending",
          parentId: "home",
          order: 0,
          steps: ["send"],
        },
      ])
    )
    expect(result.warnings).toContain(
      'flow "home" has only one child "sending"; merge the child\'s steps into the parent and preserve the parent identity unless both are independently useful intents'
    )
  })

  it("allows brand casing but rejects whole machine-style camelCase tokens", () => {
    const brandGraph = graph([
      node("paypal", "other", { texts: ["Link PayPal"] }),
      node("redotpay", "other", { texts: ["RedotPay Card"] }),
      node("ios", "other", { texts: ["iOS Onboarding"] }),
    ])
    const valid = validateFlows(
      brandGraph,
      flows([
        {
          id: "brand-flow",
          name: "Link PayPal on iOS",
          parentId: null,
          order: 0,
          steps: ["paypal", "redotpay", "ios"],
        },
      ])
    )
    expect(valid.errors).toEqual([])

    const machineGraph = graph([
      node("card", "other", { texts: ["cardMyCards"] }),
    ])
    const invalid = validateFlows(
      machineGraph,
      flows([
        {
          id: "managing-cards",
          name: "managePaymentMethods",
          parentId: null,
          order: 0,
          steps: ["card"],
        },
      ])
    )
    expect(
      invalid.errors.some((error) => error.includes('"managePaymentMethods"'))
    ).toBe(true)
    expect(
      invalid.errors.some((error) => error.includes('"cardMyCards"'))
    ).toBe(true)
  })

  it("returns structural errors instead of throwing on malformed flow drafts", () => {
    const g = graph([node("home")])
    const malformed = [
      {
        schemaVersion: 1,
        flows: {},
        uncovered: {},
        flowTODO: [],
        expected: "flows must be an array",
      },
      {
        schemaVersion: 1,
        flows: [null],
        uncovered: {},
        flowTODO: [],
        expected: "flows[0] must be an object",
      },
      {
        schemaVersion: 1,
        flows: [
          {
            id: "home",
            name: "Home",
            parentId: null,
            order: 0,
            steps: ["home"],
            entryPoints: {},
          },
        ],
        uncovered: {},
        flowTODO: [],
        expected: "entryPoints must be an array when present",
      },
    ]

    for (const { expected, ...source } of malformed) {
      expect(() =>
        validateFlows(g, source as unknown as FlowsFile)
      ).not.toThrow()
      expect(
        validateFlows(g, source as unknown as FlowsFile).errors.some((error) =>
          error.includes(expected)
        )
      ).toBe(true)
    }
  })
})

describe("derivations and coverage", () => {
  const overrides: Overrides = {
    screens: {
      gold: { stateGroup: "asset", state: "Gold", title: "Asset detail" },
      metadao: { stateGroup: "asset", state: "MetaDAO", title: "Asset detail" },
      available: { stateGroup: "cards", state: "Available", title: "Cards" },
      active: { stateGroup: "cards", state: "Active", title: "Cards" },
    },
  }

  it("preserves the authored primary while data and lifecycle derivations share its occurrence", () => {
    const g = graph(
      [
        node("markets"),
        node("gold"),
        node("metadao"),
        node("available"),
        node("active"),
      ],
      [],
      { overrides }
    )
    const view = packageGraph(
      g,
      flows([
        {
          id: "markets",
          name: "Markets",
          parentId: null,
          order: 0,
          steps: ["markets"],
        },
        {
          id: "viewing-assets",
          name: "Viewing assets",
          parentId: "markets",
          order: 0,
          steps: ["metadao"],
        },
        {
          id: "cards",
          name: "Cards",
          parentId: null,
          order: 1,
          steps: ["available"],
        },
      ])
    )
    const assetFlow = view.flows.find((flow) => flow.id === "viewing-assets")!
    expect(assetFlow.steps.at(-1)?.screenId).toBe("metadao")
    expect(
      view.screens.find((screen) => screen.id === "gold")?.appearsIn
    ).toEqual(view.screens.find((screen) => screen.id === "metadao")?.appearsIn)
    expect(
      view.screens.find((screen) => screen.id === "active")?.appearsIn
    ).toEqual(
      view.screens.find((screen) => screen.id === "available")?.appearsIn
    )
    expect(view.stats.coveredScreens).toBe(5)
  })

  it("rejects duplicate derivation labels and covered-plus-uncovered groups", () => {
    const g = graph([node("a"), node("b")], [], {
      overrides: {
        screens: { a: { stateGroup: "g" }, b: { stateGroup: "g" } },
      },
    })
    const result = validateFlows(
      g,
      flows(
        [{ id: "root", name: "Root", parentId: null, order: 0, steps: ["a"] }],
        { b: "noise" }
      ),
      { strict: true }
    )
    expect(
      result.errors.some((error) => error.includes("duplicate label"))
    ).toBe(true)
    expect(
      result.errors.some((error) =>
        error.includes("both covered and uncovered")
      )
    ).toBe(true)
  })

  it("requires non-empty, URL-distinct variation names", () => {
    const missingName = graph([node("a"), node("b")], [], {
      overrides: {
        screens: {
          a: { stateGroup: "g", state: "" },
          b: { stateGroup: "g", state: "Named" },
        },
      },
    })
    const collidingNames = graph([node("a"), node("b")], [], {
      overrides: {
        screens: {
          a: { stateGroup: "g", state: "Promo code" },
          b: { stateGroup: "g", state: "Promo-code" },
        },
      },
    })
    const source = flows([
      { id: "root", name: "Root", parentId: null, order: 0, steps: ["a"] },
    ])

    expect(validateFlows(missingName, source).errors).toContain(
      'derivation group "g": member "a" must have a non-empty variation name'
    )
    expect(validateFlows(collidingNames, source).errors).toContain(
      'derivation group "g": duplicate variation URL name "promo-code" (member "b")'
    )
  })

  it("warns when a main-nav section has no authored journey", () => {
    const g = graph([node("home"), node("card")], [], {
      mainNav: ["home", "card"],
    })
    const result = validateFlows(
      g,
      flows(
        [
          {
            id: "home",
            name: "Home",
            parentId: null,
            order: 0,
            steps: ["home"],
          },
        ],
        { card: "Capture gap" }
      )
    )

    expect(result.warnings).toContain(
      "main-nav section(s) with no captured journey: card — walk past these tabs and re-capture"
    )
  })
})

describe("context and best-effort replay", () => {
  it("prepends one immediate parent predecessor as context without giving it another occurrence", () => {
    const g = graph(
      [node("home", "home"), node("send", "form")],
      [edge("home", "send")]
    )
    const view = packageGraph(
      g,
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "sending",
          name: "Sending",
          parentId: "home",
          order: 0,
          steps: ["send"],
        },
      ])
    )
    const sending = view.flows.find((flow) => flow.id === "sending")!
    expect(sending.steps.map((step) => [step.screenId, step.kind])).toEqual([
      ["home", "context"],
      ["send", "screen"],
    ])
    expect(
      view.screens.find((screen) => screen.id === "home")?.appearsIn
    ).toEqual([{ flow: "home", step: 1 }])
  })

  it("keeps a split-pinned cross-family in-place launcher as child context", () => {
    const sharedSkeleton = "sk:deposit"
    const g = graph(
      [
        node("deposit", "picker", { skeletonHash: sharedSkeleton }),
        node("deposit-eth", "form", { skeletonHash: sharedSkeleton }),
      ],
      [edge("deposit", "deposit-eth", 'id="eth"', "in-place")],
      { overrides: { splits: ["deposit-eth"] } }
    )
    const view = packageGraph(
      g,
      flows([
        {
          id: "adding-money",
          name: "Adding money",
          parentId: null,
          order: 0,
          steps: ["deposit"],
        },
        {
          id: "crypto",
          name: "Crypto",
          parentId: "adding-money",
          order: 0,
          steps: ["deposit-eth"],
        },
      ])
    )

    expect(
      view.flows
        .find((flow) => flow.id === "crypto")
        ?.steps.map((step) => [step.screenId, step.kind, step.action])
    ).toEqual([
      ["deposit", "context", "Entry point"],
      ["deposit-eth", "screen", "Go deposit-eth"],
    ])
  })

  it("deduplicates context candidates by derivation group and retains every valid member", () => {
    const g = graph(
      [node("home"), node("home-empty"), node("send")],
      [edge("home", "send"), edge("home-empty", "send")],
      {
        overrides: {
          screens: {
            home: { stateGroup: "home", state: "default" },
            "home-empty": { stateGroup: "home", state: "empty" },
          },
        },
      }
    )
    const view = packageGraph(
      g,
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "sending",
          name: "Sending",
          parentId: "home",
          order: 0,
          steps: ["send"],
        },
      ])
    )

    expect(
      view.flows.find((flow) => flow.id === "sending")?.steps[0]
    ).toMatchObject({
      screenId: "home",
      kind: "context",
      variationIds: ["home", "home-empty"],
    })
  })

  it("preserves the exact non-default variation that exposes a child flow", () => {
    const g = graph(
      [node("card"), node("card-issued"), node("add-card")],
      [edge("card-issued", "add-card")],
      {
        overrides: {
          screens: {
            card: { stateGroup: "card", state: "Available" },
            "card-issued": { stateGroup: "card", state: "Issued" },
          },
        },
      }
    )
    const view = packageGraph(
      g,
      flows([
        { id: "card", name: "Card", parentId: null, order: 0, steps: ["card"] },
        {
          id: "adding-a-card",
          name: "Adding a card",
          parentId: "card",
          order: 0,
          steps: ["add-card"],
        },
      ])
    )

    expect(
      view.flows.find((flow) => flow.id === "adding-a-card")?.steps[0]
    ).toMatchObject({
      screenId: "card-issued",
      kind: "context",
      variationIds: ["card-issued"],
    })
  })

  it("allows a child journey to pass through exact states of its parent screen", () => {
    const g = graph(
      [node("card-verify"), node("card-funded"), node("card-issued"), node("kyc")],
      [
        edge("card-verify", "kyc"),
        edge("kyc", "card-funded"),
        edge("card-funded", "card-issued"),
      ],
      {
        overrides: {
          screens: {
            "card-verify": { stateGroup: "card", state: "Verify" },
            "card-funded": { stateGroup: "card", state: "Funded" },
            "card-issued": { stateGroup: "card", state: "Issued" },
          },
        },
      }
    )
    const view = packageGraph(
      g,
      flows([
        {
          id: "card",
          name: "Card",
          parentId: null,
          order: 0,
          steps: ["card-verify"],
        },
        {
          id: "registering-card",
          name: "Registering card",
          parentId: "card",
          order: 0,
          steps: ["kyc", "card-funded", "card-issued"],
        },
      ])
    )

    expect(
      view.flows
        .find((flow) => flow.id === "registering-card")
        ?.steps.map((step) => [step.screenId, step.variationIds])
    ).toEqual([
      ["card-verify", ["card-verify"]],
      ["kyc", undefined],
      ["card-funded", ["card-funded"]],
      ["card-issued", ["card-issued"]],
    ])
  })

  it("compiles direct forward and picker patterns", () => {
    const nodes = [
      node("home"),
      node("start"),
      node("picker", "picker"),
      node("done"),
    ]
    const edges = [
      edge("home", "start"),
      edge("start", "picker"),
      edge("picker", "start"),
      edge("start", "done"),
    ]
    const view = packageGraph(
      graph(nodes, edges),
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "onboarding",
          name: "Onboarding",
          parentId: "home",
          order: 0,
          steps: ["start", "picker", "done"],
        },
      ])
    )
    const replay = view.flows.find((flow) => flow.id === "onboarding")!.replay
    expect(replay.status).toBe("available")
    if (replay.status === "available") {
      expect(
        replay.commands
          .filter((command) => command.command === "click")
          .map((command) => command.positionals[0])
      ).toEqual([
        'id="home-start"',
        'id="start-picker"',
        'id="picker-start"',
        'id="start-done"',
      ])
    }
    expect(
      view.flows.find((flow) => flow.id === "onboarding")?.steps.at(-1)?.action
    ).toBe("Go done")
  })

  it("marks selector-less and zero-command replays unavailable", () => {
    const selectorless = packageGraph(
      graph([node("home"), node("send")], [edge("home", "send", null)]),
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "sending",
          name: "Sending",
          parentId: "home",
          order: 0,
          steps: ["send"],
        },
      ])
    )
    expect(
      selectorless.flows.find((flow) => flow.id === "sending")?.replay
    ).toEqual({
      status: "unavailable",
      reason: "Transition home → send has no replay selector",
    })

    const empty = packageGraph(
      graph([node("root"), node("standalone")]),
      flows([
        { id: "root", name: "Root", parentId: null, order: 0, steps: ["root"] },
        {
          id: "standalone",
          name: "Standalone",
          parentId: null,
          order: 1,
          steps: ["standalone"],
        },
      ])
    )
    expect(
      empty.flows.find((flow) => flow.id === "standalone")?.replay
    ).toEqual({
      status: "unavailable",
      reason: "Flow compiles to no replay commands",
    })
  })

  it("does not treat a back edge as an inline-picker return", () => {
    const view = packageGraph(
      graph(
        [node("a"), node("b"), node("c")],
        [
          edge("a", "b"),
          edge("b", "a", 'id="back"', "back"),
          edge("a", "c"),
          edge("b", "c"),
        ],
        { root: "a" }
      ),
      flows([
        {
          id: "forward",
          name: "Forward",
          parentId: null,
          order: 0,
          steps: ["a", "b", "c"],
        },
      ])
    )
    const replay = view.flows[0].replay
    expect(replay.status).toBe("available")
    if (replay.status === "available")
      expect(replay.commands.map((command) => command.positionals[0])).toEqual([
        "com.demo",
        'id="a-b"',
        'id="b-c"',
      ])
  })

  it("keeps the recorded continuation label after a back-dismissed inline picker", () => {
    const view = packageGraph(
      graph(
        [node("start"), node("picker"), node("done")],
        [
          edge("start", "picker", 'id="open"', "overlay"),
          edge("picker", "start", null, "back"),
          {
            ...edge("start", "done", 'id="finish"', "overlay"),
            action: "Slide to finish",
          },
        ],
        { root: "start" }
      ),
      flows([
        {
          id: "finishing",
          name: "Finishing",
          parentId: null,
          order: 0,
          steps: ["start", "picker", "done"],
        },
      ])
    )

    expect(view.flows[0].steps[2].action).toBe("Slide to finish")
    expect(view.flows[0].replay.status).toBe("unavailable")
  })

  it("publishes every semantic step when replay is unavailable", () => {
    const view = packageGraph(
      graph([node("home"), node("one"), node("two")]),
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "intent",
          name: "Doing something",
          parentId: "home",
          order: 0,
          steps: ["one", "two"],
        },
      ])
    )
    const intent = view.flows.find((flow) => flow.id === "intent")!
    expect(intent.steps.map((step) => step.screenId)).toEqual(["one", "two"])
    expect(intent.replay.status).toBe("unavailable")
    expect(view.stats.replayUnavailable).toBe(1)
  })
})

describe("occurrences, decisions, and determinism", () => {
  it("preserves repeated local occurrences and refuses to guess an ambiguous decision link", () => {
    const g = graph([node("home"), node("detail")], [], {
      decisionPoints: [
        {
          nodeId: "home",
          options: [{ label: "Detail", explored: true, toNode: "detail" }],
        },
      ],
    })
    const view = packageGraph(
      g,
      flows([
        { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
        {
          id: "reviewing",
          name: "Reviewing",
          parentId: "home",
          order: 0,
          steps: ["detail"],
        },
        {
          id: "sharing",
          name: "Sharing",
          parentId: "home",
          order: 1,
          steps: ["detail"],
        },
      ])
    )
    expect(
      view.screens.find((screen) => screen.id === "detail")?.appearsIn
    ).toEqual([
      { flow: "reviewing", step: 1 },
      { flow: "sharing", step: 1 },
    ])
    expect(view.decisionPoints[0].options[0].flowSlug).toBeUndefined()
    expect(
      view.diagnostics.some(
        (diagnostic) => diagnostic.code === "ambiguous-decision-target"
      )
    ).toBe(true)
  })

  it("is byte-stable under graph and semantically unordered flow reordering", () => {
    const g = graph(
      [node("home"), node("earn"), node("add")],
      [edge("home", "add"), edge("earn", "add")]
    )
    const source = flows([
      { id: "earn", name: "Earn", parentId: null, order: 1, steps: ["earn"] },
      {
        id: "adding",
        name: "Adding",
        parentId: "home",
        order: 0,
        steps: ["add"],
        entryPoints: [
          {
            flowId: "earn",
            fromScreenId: "earn",
            toScreenId: "add",
          },
        ],
      },
      { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
    ])
    const reversedGraph = {
      ...g,
      nodes: [...g.nodes].reverse(),
      edges: [...g.edges].reverse(),
    }
    const reversedFlows = { ...source, flows: [...source.flows].reverse() }
    expect(JSON.stringify(packageGraph(reversedGraph, reversedFlows))).toBe(
      JSON.stringify(packageGraph(g, source))
    )
  })

  it("orders the Screens tab by semantic flow order with variations together", () => {
    const g = graph(
      [node("home"), node("intro-2"), node("intro-1")],
      [edge("intro-1", "home")],
      {
        overrides: {
          screens: {
            "intro-1": { stateGroup: "introduction", state: "1" },
            "intro-2": { stateGroup: "introduction", state: "2" },
          },
        },
      }
    )
    const view = packageGraph(
      g,
      flows([
        {
          id: "getting-started",
          name: "Getting started",
          parentId: null,
          order: 0,
          steps: ["intro-1", "home"],
        },
      ])
    )

    expect(view.screens.map((screen) => screen.id)).toEqual([
      "intro-1",
      "intro-2",
      "home",
    ])
  })
})

describe("inventory, audit, and mechanical migration", () => {
  it("emits post-SAF inventory and canonicalizes references without semantic edits", () => {
    const g = graph(
      [
        node("home"),
        node("old", "other", { interactiveElements: [element("one")] }),
        node("new", "other", {
          interactiveElements: [element("one"), element("two")],
        }),
      ],
      [],
      { overrides: { merges: [["old", "new"]] } }
    )
    const source = flows([
      {
        id: "home",
        name: "Home",
        parentId: null,
        order: 0,
        steps: ["home", "old", "old"],
      },
    ])
    const migrated = migrateFlows(g, source)
    expect(migrated.flows.flows[0].steps).toEqual(["home", "new"])
    expect(migrated.canonicalizations).toEqual([
      { location: "flows.home.steps[1]", from: "old", to: "new" },
      { location: "flows.home.steps[2]", from: "old", to: "new" },
    ])
    expect(buildInventory(g).canonicalizations).toEqual([
      { from: "old", to: "new" },
    ])
  })

  it("preserves unknown fields and merges uncovered reasons on canonical collisions", () => {
    const g = graph(
      [
        node("home"),
        node("old", "other", { interactiveElements: [element("one")] }),
        node("new", "other", {
          interactiveElements: [element("one"), element("two")],
        }),
      ],
      [],
      { overrides: { merges: [["old", "new"]] } }
    )
    const source = {
      ...flows(
        [
          {
            id: "home",
            name: "Home",
            parentId: null,
            order: 0,
            steps: ["home"],
          },
        ],
        { old: "Old reason", new: "New reason" }
      ),
      authorNote: "keep me",
    } as FlowsFile & { authorNote: string }
    const migrated = migrateFlows(g, source)

    expect(migrated.flows.uncovered).toEqual({
      new: "New reason; Old reason",
    })
    expect(
      (migrated.flows as FlowsFile & { authorNote?: string }).authorNote
    ).toBe("keep me")
    expect(migrated.warnings).toEqual([
      'uncovered "new" combines canonicalized entries "new" ("New reason"), "old" ("Old reason")',
    ])
  })

  it("aggregates all-package audit findings", () => {
    const validGraph = graph([node("home")])
    const validFlows = flows([
      { id: "home", name: "Home", parentId: null, order: 0, steps: ["home"] },
    ])
    const invalidGraph = graph([node("home"), node("lost")])
    const report = auditFlowPackages([
      { key: "b/2", graph: invalidGraph, flows: validFlows },
      { key: "a/1", graph: validGraph, flows: validFlows },
    ])
    expect(report.packages.map((item) => item.key)).toEqual(["a/1", "b/2"])
    expect(report.totals.packages).toBe(2)
    expect(report.totals.errors).toBeGreaterThan(0)
    expect(report.totals.unaccounted).toBe(1)
  })

  it("rejects retired graph semantic overrides", () => {
    const g = graph([node("home")])
    g.overrides = { flowNames: { home: "Home" } } as unknown as Overrides
    expect(validateGraph(g).errors).toContain(
      "overrides.flowNames is retired; author semantic flows in flows.json"
    )
  })
})

describe("committed golden semantic packages", () => {
  for (const [slug, date, expectedFlows, expectedUnavailable] of [
    ["avici", "2026-06-23", 26, 18],
    ["redotpay", "2026-06-29", 64, 22],
    ["tuyo", "2026-06-05", 26, 8],
  ] as const) {
    it(`${slug} has full coverage and the reviewed semantic tree`, () => {
      const base = `public/captures/${slug}/${date}`
      const g = JSON.parse(readFileSync(`${base}/graph.json`, "utf8")) as Graph
      const source = JSON.parse(
        readFileSync(`${base}/flows.json`, "utf8")
      ) as FlowsFile
      const validation = validateFlows(g, source, { strict: true })
      const view = packageGraph(g, source)
      expect(validation.errors).toEqual([])
      expect(validation.warnings).toEqual([])
      expect(view.flows).toHaveLength(expectedFlows)
      expect(view.stats.unaccountedScreens).toBe(0)
      expect(view.stats.replayUnavailable).toBe(expectedUnavailable)
    })
  }

  it("keeps reviewed onboarding and primary tab actions as complete flows", () => {
    const aviciBase = "public/captures/avici/2026-06-23"
    const aviciView = packageGraph(
      JSON.parse(readFileSync(`${aviciBase}/graph.json`, "utf8")) as Graph,
      JSON.parse(readFileSync(`${aviciBase}/flows.json`, "utf8")) as FlowsFile
    )
    expect(
      aviciView.flows
        .find((flow) => flow.id === "getting-started")
        ?.steps.map((step) => step.screenId)
    ).toEqual(["welcome", "email-login", "email-otp", "home-onboarding"])
    expect(aviciView.flows.some((flow) => flow.id === "signing-in")).toBe(false)
    expect(
      aviciView.flows.find((flow) => flow.id === "adding-a-card")?.steps[0]
    ).toMatchObject({
      screenId: "card-my-cards",
      kind: "context",
      variationIds: ["card-my-cards"],
    })

    const redotBase = "public/captures/redotpay/2026-06-29"
    const redotView = packageGraph(
      JSON.parse(readFileSync(`${redotBase}/graph.json`, "utf8")) as Graph,
      JSON.parse(readFileSync(`${redotBase}/flows.json`, "utf8")) as FlowsFile
    )
    expect(
      redotView.flows
        .find((flow) => flow.id === "send")
        ?.steps.map((step) => step.screenId)
    ).toEqual([
      "send",
      "send-from-currency",
      "send-to-currency",
      "send-global-details",
    ])
    expect(redotView.flows.some((flow) => flow.id === "sending-globally")).toBe(
      false
    )
    expect(
      redotView.flows.find((flow) => flow.id === "editing-home-widgets")?.name
    ).toBe("Editing home widgets")
    expect(
      redotView.flows.find((flow) => flow.id === "setting-card-limits")
        ?.steps[0]
    ).toMatchObject({
      screenId: "card-active",
      kind: "context",
      variationIds: ["card-active"],
    })
    expect(
      redotView.flows.find((flow) => flow.id === "registering-a-card")?.steps[0]
    ).toMatchObject({
      screenId: "card",
      kind: "context",
      variationIds: ["card"],
    })
    expect(
      redotView.flows
        .find((flow) => flow.id === "signing-in")
        ?.steps.find((step) => step.screenId === "login")?.variationIds
    ).toBeUndefined()
    expect(
      redotView.screens.find((screen) => screen.id === "home")?.title
    ).toBe("Home")
    expect(
      redotView.screens.find((screen) => screen.id === "profile")?.title
    ).toBe("Account")
  })
})
