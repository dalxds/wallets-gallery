// Packager type contracts.
//
// Two worlds:
//   GRAPH  — the single source of truth on disk ({slug}/{date}/graph.json).
//            Observation (nodes + edges + decisionPoints) written by the capture
//            agent, plus a small `overrides` block written only by the edit agent.
//   VIEW   — derived by package(graph). Never stored; the SSG build renders it.
//
// This file is pure types (erased at compile time) so it is safe to import from
// client components. All runtime logic lives in the sibling modules, which import
// node:crypto and therefore run only at build time / in the CLI.

export type Platform = "ios" | "android"

export type ScreenRole =
  | "home"
  | "list"
  | "picker"
  | "form"
  | "confirmation"
  | "auth"
  | "modal"
  | "settings"
  | "error"
  | "other"

export type StateLabel = "default" | "empty" | "loading" | "error" | "max"

// How a transition relates its two screens. Computed at capture time by comparing
// the pre/post skeleton hash; it is the deterministic signal that drives state
// routing (an `in-place` edge between two variants of one logical screen => an
// on-step state toggle, never a navigation step).
export type EdgeKind = "nav" | "overlay" | "in-place" | "back"

export interface InteractiveElement {
  label: string
  role: string
  selector: string | null
  /**
   * Call-to-action emphasis, tagged inline at capture: "primary" for the screen's
   * main action, "secondary" for a notable alternate. Omit for ordinary elements.
   * Read the primary CTA as `interactiveElements.find(e => e.emphasis === "primary")`.
   * Does NOT affect screen identity (fingerprint/skeleton ignore it).
   */
  emphasis?: "primary" | "secondary"
}

// ─────────────────────────── GRAPH (source) ───────────────────────────

export interface GraphNode {
  /** Stable slug, agent-assigned, human-correctable via overrides.screens[id].title is separate. */
  id: string
  /** Identity hash: sha256 of sorted (role,label) pairs of hittable elements. */
  fingerprint: string
  /** Structure-only hash (labels/text stripped) — clusters variants of one logical screen. */
  skeletonHash: string
  /** Perceptual hash of the screenshot; backstop identity signal. Null when no usable shot. */
  pHash: string | null
  role: ScreenRole
  screenshotPath: string
  snapshotPath: string | null
  texts: string[]
  interactiveElements: InteractiveElement[]
}

export interface GraphEdge {
  from: string
  to: string
  /** Human-readable action, e.g. `Tap "Max"`. */
  action: string
  selector: string | null
  kind: EdgeKind
  /** Order of observation during the walk; used for deterministic tie-breaks. */
  observedAtStep: number
}

export interface DecisionOption {
  label: string
  explored: boolean
  /** Node this option navigates to, when known. */
  toNode?: string | null
  note?: string
}

export interface DecisionPoint {
  nodeId: string
  options: DecisionOption[]
}

// The ONLY hand-edited surface. Written exclusively by the edit agent (chat →
// override → re-derive). Preserved verbatim across re-captures.
export interface Overrides {
  /** flow id (= anchor node id) → flow name (LLM-/human-chosen; must persist for the static build). */
  flowNames?: Record<string, string>
  /**
   * flow id → corrections to the derived tree's shape. One lever: `parent` re-parents a
   * flow under another, or pins it to the root with `parent: null`. (Main-nav sections are
   * handled generally by graph.mainNav — they never need a per-flow override here.)
   */
  structure?: Record<string, { parent?: string | null }>
  /** node id → screen-fact corrections (incl. forced state classification). */
  screens?: Record<
    string,
    { role?: ScreenRole; title?: string; description?: string; state?: StateLabel; stateGroup?: string }
  >
  /** groups of node ids to force-merge into one logical screen. */
  merges?: string[][]
  /** node ids to force-keep distinct even if the SAF would merge them. */
  splits?: string[]
}

export interface GraphMeta {
  schemaVersion: 2
  app: { name: string; slug: string; bundleId: string; platform: Platform }
  captureDate: string
  scope: "initial" | "full" | "flow"
  mode: "guided" | "free-roam" | "replay"
  previousCapture: string | null
  durationSeconds?: number
}

export interface Graph {
  meta: GraphMeta
  /** Launch node id (BFS root). */
  root: string
  /**
   * Main-navigation destination node ids — the app's top-level sections, however they're
   * presented (bottom-tab bar, nav rail, drawer). Each becomes a top-level flow that roots
   * its own subtree instead of nesting under whatever screen launched it. Record the node
   * each nav item navigates TO; omit/empty for apps with no persistent main navigation.
   */
  mainNav?: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  decisionPoints: DecisionPoint[]
  overrides: Overrides
}

// ─────────────────────────── VIEW (derived) ───────────────────────────

// The rendered projection of a screen: its content (texts + interactive elements,
// CTAs tagged via element.emphasis), the flows it appears in, and any derived state
// grouping. The internal identity fingerprint stays on the GRAPH node — it's packager
// plumbing, not view data — as does the raw snapshot.
export interface ViewScreen {
  /** Logical screen id (post-merge). */
  id: string
  title: string
  role: ScreenRole
  description: string
  screenshotPath: string
  texts: string[]
  interactiveElements: InteractiveElement[]
  /** Set only when this screen is part of a multi-variant group (on-step switcher). */
  state?: StateLabel
  stateGroup?: string
  /** Flows (and the step within each) where this screen appears — derived from the flow tree. */
  appearsIn: { flow: string; step: number }[]
}

export interface ViewStep {
  number: number
  title: string
  screenId: string
  action: string
  screenshotPath: string
}

export interface ReplayCommand {
  command: string
  positionals: string[]
  flags: Record<string, unknown>
}

export interface ViewReplay {
  /** Inline .ad command list (materialized to a temp file only when actually replaying). */
  commands: ReplayCommand[]
  entryFingerprint: string
  confidence: "high" | "medium" | "low"
}

export type NameSource = "override" | "mechanical"

export interface ViewFlow {
  slug: string
  name: string
  parent: string | null
  summary: string
  entryPoints: string[]
  steps: ViewStep[]
  replay: ViewReplay | null
  /** Provenance of `name`; "mechanical" means it still wants a real (LLM/human) name. */
  nameSource: NameSource
}

export interface View {
  app: GraphMeta["app"]
  captureDate: string
  screens: ViewScreen[]
  flows: ViewFlow[]
  decisionPoints: {
    screenId: string
    options: { label: string; explored: boolean; flowSlug?: string }[]
  }[]
  stats: {
    screens: number
    rawNodes: number
    flows: number
    topLevelFlows: number
    replayCoverage: number
  }
  /** Flows whose name is still mechanical — the agent fills these in via overrides.flowNames. */
  namingTODO: { entryNodeId: string; slug: string; mechanicalName: string }[]
}
