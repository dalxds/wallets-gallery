import { describe, it, expect } from "vitest"
import { assembleGraph, type Walk, type AssembleIO } from "@/scripts/assemble.ts"
import { computeFingerprint, computeTextFingerprint, skeletonFromElements } from "@/lib/packager/identity.ts"
import { validateGraph } from "@/lib/packager/validate.ts"
import type { InteractiveElement } from "@/lib/packager/types.ts"

// Stub I/O — assembleGraph never touches the filesystem; we feed it deterministic
// asset paths and a pHash keyed off the shot name.
const io: AssembleIO = {
  pHashOf: (shot) => (shot ? `p:${shot}` : null),
  addressShot: (shot) => (shot ? `assets/${shot}.png` : ""),
  addressSnap: (snap) => (snap ? `assets/${snap}.snap.json` : null),
}

const el = (label: string): InteractiveElement => ({ label, role: "button", selector: `label="${label}"` })

function baseWalk(): Walk {
  return {
    meta: { app: { name: "Demo", slug: "demo", bundleId: "com.demo", platform: "android" }, captureDate: "2026-06-05", scope: "initial", mode: "guided", previousCapture: null },
    root: "home",
    nodes: [
      { id: "home", role: "home", shot: "001", snap: "001snap", texts: ["Balance"], interactiveElements: [el("Deposit"), el("Trade")] },
      // a structural twin of home (same role + element roles) → same skeletonHash
      { id: "home-loaded", role: "home", shot: "002", snap: null, texts: ["Balance", "$10"], interactiveElements: [el("Send"), el("Swap")] },
      { id: "detail", role: "list", shot: "003", snap: "003snap", texts: ["Activity"], interactiveElements: [el("Row 1")] },
      // a Tier-2 screen: no interactive elements → text fingerprint + skeleton
      { id: "secure", role: "auth", shot: null, snap: null, texts: ["Enter code", "Verify"] },
    ],
    edges: [],
    decisionPoints: [],
  }
}

describe("assembleGraph", () => {
  it("computes element fingerprint + skeleton from observations", () => {
    const { graph } = assembleGraph(baseWalk(), io)
    const home = graph.nodes.find((n) => n.id === "home")!
    expect(home.fingerprint).toBe(computeFingerprint([el("Deposit"), el("Trade")]))
    expect(home.skeletonHash).toBe(skeletonFromElements("home", [el("Deposit"), el("Trade")]))
    expect(home.pHash).toBe("p:001")
    expect(home.screenshotPath).toBe("assets/001.png")
    expect(home.snapshotPath).toBe("assets/001snap.snap.json")
  })

  it("falls back to text fingerprint for a shot-less / element-less screen", () => {
    const { graph } = assembleGraph(baseWalk(), io)
    const secure = graph.nodes.find((n) => n.id === "secure")!
    expect(secure.fingerprint).toBe(computeTextFingerprint(["Enter code", "Verify"]))
    expect(secure.fingerprint.startsWith("sha256-text:")).toBe(true)
    expect(secure.pHash).toBeNull()
    expect(secure.screenshotPath).toBe("")
    expect(secure.snapshotPath).toBeNull()
  })

  it("derives in-place vs nav from skeleton equality", () => {
    const walk = baseWalk()
    walk.edges = [
      { from: "home", to: "home-loaded", action: "Load" }, // shared skeleton → in-place
      { from: "home", to: "detail", action: "Open detail" }, // different skeleton → nav
    ]
    const { graph } = assembleGraph(walk, io)
    expect(graph.edges.find((e) => e.to === "home-loaded")!.kind).toBe("in-place")
    expect(graph.edges.find((e) => e.to === "detail")!.kind).toBe("nav")
  })

  it("honors recorded back/overlay (skeleton can't detect them)", () => {
    const walk = baseWalk()
    walk.edges = [
      { from: "detail", to: "home", action: "Back", kind: "back" },
      { from: "home", to: "detail", action: "Sheet", kind: "overlay" },
    ]
    const { graph } = assembleGraph(walk, io)
    expect(graph.edges.find((e) => e.action === "Back")!.kind).toBe("back")
    expect(graph.edges.find((e) => e.action === "Sheet")!.kind).toBe("overlay")
  })

  it("overrides a disagreeing recorded nav/in-place with a warning", () => {
    const walk = baseWalk()
    walk.edges = [{ from: "home", to: "home-loaded", action: "Load", kind: "nav" }] // shared skeleton → skeleton wins
    const { graph, warnings } = assembleGraph(walk, io)
    expect(graph.edges[0].kind).toBe("in-place")
    expect(warnings.some((w) => w.includes("home→home-loaded"))).toBe(true)
  })

  it("defaults selector to null, assigns observedAtStep, and carries meta/overrides", () => {
    const walk = baseWalk()
    walk.edges = [{ from: "home", to: "detail", action: "Open" }]
    walk.overrides = { flowNames: { home: "Home" } }
    const { graph } = assembleGraph(walk, io)
    expect(graph.edges[0].selector).toBeNull()
    expect(graph.edges[0].observedAtStep).toBe(1)
    expect(graph.meta.schemaVersion).toBe(2)
    expect(graph.overrides).toEqual({ flowNames: { home: "Home" } })
  })

  it("produces a graph that passes validation", () => {
    const walk = baseWalk()
    walk.edges = [{ from: "home", to: "detail", action: "Open" }]
    const { graph } = assembleGraph(walk, io)
    expect(validateGraph(graph).errors).toEqual([])
  })
})
