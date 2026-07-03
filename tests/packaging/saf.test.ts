import { describe, it, expect } from "vitest"
import { runSAF } from "@/lib/packager/saf.ts"
import type { GraphNode, ScreenRole } from "@/lib/packager/types.ts"

// Minimal node: runSAF only reads id/skeletonHash/pHash/texts/interactiveElements.
function node(id: string, skeletonHash: string, texts: string[], pHash: string | null = null): GraphNode {
  return {
    id,
    fingerprint: "sha256:" + id,
    skeletonHash,
    pHash,
    role: "other" as ScreenRole,
    screenshotPath: `assets/${id}.png`,
    snapshotPath: null,
    texts,
    interactiveElements: [],
  }
}

// The partition of raw ids into merge classes — order-independent, so it captures
// "which nodes merged" without depending on canonicalNodes display order (which
// intentionally follows input order).
function partition(res: ReturnType<typeof runSAF>, ids: string[]): string[] {
  const byRoot = new Map<string, string[]>()
  for (const id of ids) {
    const c = res.canonicalOf.get(id)!
    const arr = byRoot.get(c)
    if (arr) arr.push(id)
    else byRoot.set(c, [id])
  }
  return [...byRoot.values()].map((m) => m.slice().sort().join(",")).sort()
}

describe("runSAF — splits are split-proof and order-independent", () => {
  // x, y, z share a merge key (same skeleton + same normalized text) → one class by default.
  const mk = (id: string) => node(id, "sk:dup", ["Trading requires USDC", "Continue"])

  it("a split on one merge-group member does not block the others' merge", () => {
    for (const order of [["x", "y", "z"], ["y", "x", "z"], ["z", "y", "x"]]) {
      const res = runSAF(order.map(mk), { splits: ["x"] })
      // y and z still merge; x is separate → 2 classes, independent of input order.
      expect(res.canonicalNodes.length).toBe(2)
      expect(partition(res, ["x", "y", "z"])).toEqual(["x", "y,z"])
    }
  })

  it("the full merge partition is identical when the nodes array is reversed", () => {
    const nodes = ["x", "y", "z"].map(mk)
    const forward = partition(runSAF(nodes, { splits: ["x"] }), ["x", "y", "z"])
    const reversed = partition(runSAF([...nodes].reverse(), { splits: ["x"] }), ["x", "y", "z"])
    expect(reversed).toEqual(forward)
  })
})

describe("runSAF — forced merges survive a stale anchor id", () => {
  it("merges the surviving members when the group's first id no longer exists", () => {
    // d1/d2 have distinct merge keys, so ONLY the forced merge can join them.
    const nodes = [node("d1", "sk:a", ["Alpha"]), node("d2", "sk:b", ["Beta"])]
    const res = runSAF(nodes, { merges: [["stale", "d1", "d2"]] })
    expect(res.canonicalOf.get("d1")).toBe(res.canonicalOf.get("d2"))
    expect(res.canonicalNodes.length).toBe(1)
  })
})
