// Assemble a validated graph.json from a raw _staging/walk.json of observations.
//
// During the walk the capture agent records ONLY raw observation — one entry per
// screen (role + texts + interactiveElements + a staging screenshot/snapshot path
// + optional routeKey), plus edges and decisionPoints. This tool turns that into
// the source-of-truth graph.json:
//
//   • computes the four identity signals deterministically — fingerprint +
//     skeletonHash via identity.ts, pHash via phash.ts — so the agent never
//     hand-hashes (the failure mode that yields a null/garbage fingerprint);
//   • content-addresses each staging screenshot/snapshot into assets/<sha>.png|.snap.json
//     (deduped within this app), rewriting the node paths;
//   • finalizes each edge's in-place/nav kind from skeleton equality (the deterministic
//     state-toggle signal), honoring agent-recorded back/overlay which skeletons can't see;
//   • validates and writes graph.json (refuses to write on a validation error).
//
//   node scripts/assemble.ts <walk.json> <out/graph.json>
//
// Run from the repo root: node.shot / node.snap paths in walk.json resolve relative to
// CWD; assets are written under <appDir>/assets where appDir = dirname(dirname(out)).
// Then run `node scripts/package.ts <out/graph.json>` for the flow tree + namingTODO.

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, join } from "node:path"
import { computeFingerprint, computeTextFingerprint, skeletonFromElements, skeletonFromTexts } from "../lib/packager/identity.ts"
import { validateGraph } from "../lib/packager/validate.ts"
import { pHashFromPng } from "./phash.ts"
import type { Graph, GraphEdge, GraphNode, DecisionPoint, Overrides, InteractiveElement, ScreenRole, GraphMeta } from "../lib/packager/types.ts"

// ── Raw walk (the only artifact the agent authors during exploration) ─────────

export interface WalkNode {
  id: string
  role: ScreenRole
  /** Staging screenshot path (relative to CWD). null only for a truly shot-less screen. */
  shot: string | null
  /** Staging raw-snapshot path; null in Tier 2/3 (no usable snapshot). */
  snap?: string | null
  /** Android resource-id of the root / iOS VC class when recoverable, else null. */
  routeKey?: string | null
  texts?: string[]
  interactiveElements?: InteractiveElement[]
  primaryCta?: InteractiveElement | null
  secondaryCtas?: InteractiveElement[]
}

export interface WalkEdge {
  from: string
  to: string
  action: string
  selector?: string | null
  /**
   * Behavioral hint. `back`/`overlay` are honored verbatim (skeleton equality can't
   * detect them). For `nav`/`in-place`/absent the kind is DERIVED from skeleton
   * equality — the deterministic state-toggle signal — and a recorded value that
   * disagrees is overridden with a warning.
   */
  kind?: GraphEdge["kind"]
  observedAtStep?: number
}

export interface Walk {
  meta: Omit<GraphMeta, "schemaVersion">
  root: string
  nodes: WalkNode[]
  edges?: WalkEdge[]
  decisionPoints?: DecisionPoint[]
  /** Re-capture only: copy the prior graph.json's overrides here to carry them forward. */
  overrides?: Overrides
}

// ── Pure transform (file I/O injected so it's unit-testable without real PNGs) ─

export interface AssembleIO {
  /** Perceptual hash of the staging shot, or null when there's no usable shot. */
  pHashOf: (shot: string | null) => string | null
  /** Content-address the staging shot into assets/, returning the asset-relative path ("" if none). */
  addressShot: (shot: string | null) => string
  /** Content-address the staging snapshot into assets/, returning the asset-relative path or null. */
  addressSnap: (snap: string | null | undefined) => string | null
}

export function assembleGraph(walk: Walk, io: AssembleIO): { graph: Graph; warnings: string[] } {
  const warnings: string[] = []

  const nodes: GraphNode[] = walk.nodes.map((n) => {
    const elements = n.interactiveElements ?? []
    const texts = n.texts ?? []
    return {
      id: n.id,
      fingerprint: elements.length ? computeFingerprint(elements) : computeTextFingerprint(texts),
      skeletonHash: elements.length ? skeletonFromElements(n.role, elements) : skeletonFromTexts(n.role, texts),
      pHash: io.pHashOf(n.shot),
      routeKey: n.routeKey ?? null,
      role: n.role,
      screenshotPath: io.addressShot(n.shot),
      snapshotPath: io.addressSnap(n.snap),
      texts,
      interactiveElements: elements,
      primaryCta: n.primaryCta ?? null,
      secondaryCtas: n.secondaryCtas ?? [],
    }
  })

  const skById = new Map(nodes.map((n) => [n.id, n.skeletonHash]))

  const edges: GraphEdge[] = (walk.edges ?? []).map((e, i) => {
    const skFrom = skById.get(e.from)
    const sameSk = skFrom != null && skFrom === skById.get(e.to)
    let kind: GraphEdge["kind"]
    if (e.kind === "back" || e.kind === "overlay") {
      kind = e.kind
    } else {
      kind = sameSk ? "in-place" : "nav"
      if (e.kind && e.kind !== kind)
        warnings.push(`edge ${e.from}→${e.to}: recorded kind "${e.kind}" but skeleton says "${kind}" — using "${kind}" (force distinct with overrides.splits if wrong)`)
    }
    return { from: e.from, to: e.to, action: e.action, selector: e.selector ?? null, kind, observedAtStep: e.observedAtStep ?? i + 1 }
  })

  const graph: Graph = {
    meta: { schemaVersion: 2, ...walk.meta, previousCapture: walk.meta.previousCapture ?? null },
    root: walk.root,
    nodes,
    edges,
    decisionPoints: walk.decisionPoints ?? [],
    overrides: walk.overrides ?? {},
  }
  return { graph, warnings }
}

// ── CLI: wire in the fs-backed I/O, validate, write ───────────────────────────

if (process.argv[1] && process.argv[1].endsWith("assemble.ts")) {
  const walkPath = process.argv[2]
  const outPath = process.argv[3]
  if (!walkPath || !outPath) {
    console.error("usage: node scripts/assemble.ts <walk.json> <out/graph.json>")
    process.exit(2)
  }

  const walk = JSON.parse(readFileSync(walkPath, "utf8")) as Walk
  const assetsDir = join(dirname(dirname(outPath)), "assets")
  mkdirSync(assetsDir, { recursive: true })

  const address = (src: string, ext: string): string => {
    const name = createHash("sha256").update(readFileSync(src)).digest("hex").slice(0, 12) + ext
    const dest = join(assetsDir, name)
    if (!existsSync(dest)) copyFileSync(src, dest)
    return `assets/${name}`
  }

  const warns: string[] = []
  const { graph, warnings } = assembleGraph(walk, {
    pHashOf: (shot) => (shot ? pHashFromPng(shot) : null),
    addressShot: (shot) => {
      if (!shot) { warns.push("a node has no screenshot (shot) — screenshotPath left empty"); return "" }
      return address(shot, ".png")
    },
    addressSnap: (snap) => (snap ? address(snap, ".snap.json") : null),
  })

  const { errors, warnings: vwarnings } = validateGraph(graph)
  for (const w of [...warns, ...warnings, ...vwarnings]) console.error(`warn:  ${w}`)
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`)
    console.error(`\nFAILED: ${errors.length} error(s) — graph.json not written`)
    process.exit(1)
  }

  writeFileSync(outPath, JSON.stringify(graph, null, 2))
  console.log(`assembled ${graph.nodes.length} nodes · ${graph.edges.length} edges · ${graph.decisionPoints.length} decision points · root=${graph.root} → ${outPath}`)
}
