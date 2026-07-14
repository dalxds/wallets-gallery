// Packager type contracts.
//
// Three worlds:
//   GRAPH  — observed app facts ({slug}/{date}/graph.json).
//   FLOWS  — authored semantic packaging ({slug}/{date}/flows.json).
//   VIEW   — deterministic presentation derived from GRAPH + FLOWS.
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

// The canonical lifecycle states (default/empty/loading/error/max) carry presentation
// in lib/states.ts. A custom string is also allowed for variants that aren't lifecycle
// states — e.g. carousel/onboarding slides force-grouped via overrides and labelled by
// step ("1","2","3"); `stateMeta` renders any unknown value, numeric ones in step order.
// The `string & {}` keeps literal autocomplete for the canonical set.
export type StateLabel = "default" | "empty" | "loading" | "error" | "max" | (string & {})

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

// The hand-edited observation-correction surface. Semantic flow edits belong in
// flows.json, while these overrides remain limited to observed screen identity.
export interface Overrides {
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

// ─────────────────────────── FLOWS (semantic source) ─────────────────

export interface FlowTODO {
  about: string
  question: string
}

export interface FlowDefinition {
  /** Stable semantic identifier and public URL slug. */
  id: string
  name: string
  summary?: string
  parentId: string | null
  /** Sibling order; collisions are resolved by id. */
  order: number
  /** Ordered local semantic steps. Every entry is rendered. */
  steps: string[]
  /** Exact cross-flow navigation points that visibly expose this intent. */
  entryPoints?: FlowEntryPoint[]
}

export interface FlowEntryPoint {
  /** Flow containing the screen that exposes this intent. */
  flowId: string
  /** Concrete source screen (a local step or one of its derivations). */
  fromScreenId: string
  /** Concrete destination screen (a local step or one of its derivations). */
  toScreenId: string
}

export interface FlowsFile {
  schemaVersion: 1
  flows: FlowDefinition[]
  /** screen id → why it is intentionally omitted from semantic flows. */
  uncovered: Record<string, string>
  /** Must be empty in a committed capture. */
  flowTODO: FlowTODO[]
}

export interface InventoryScreen {
  id: string
  title: string
  role: ScreenRole
  texts: string[]
  primaryCTA: string | null
  screenshotPath: string
  snapshotPath: string | null
  state?: StateLabel
  stateGroup?: string
  derivationLabel?: string
}

export interface FlowInventory {
  schemaVersion: 1
  app: GraphMeta["app"]
  captureDate: string
  root: string
  mainNav: string[]
  screens: InventoryScreen[]
  derivationGroups: { id: string; members: { id: string; label: string }[] }[]
  edges: GraphEdge[]
  decisionPoints: DecisionPoint[]
  canonicalizations: { from: string; to: string }[]
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
  /** Context is mechanically derived and never counts as semantic coverage. */
  kind: "context" | "screen"
  /** Concrete members of this step's derivation group that expose the flow transition. */
  variationIds?: string[]
}

export interface ReplayCommand {
  command: string
  positionals: string[]
  flags: Record<string, unknown>
}

export type ViewReplay =
  | {
      status: "available"
      /** Inline .ad commands, materialized only when replaying. */
      commands: ReplayCommand[]
      entryFingerprint: string
      confidence: "high" | "medium" | "low"
      warnings?: string[]
    }
  | {
      status: "unavailable"
      reason: string
    }

export interface ViewFlow {
  /** Equal to slug; retained explicitly for the semantic contract. */
  id: string
  slug: string
  name: string
  parent: string | null
  summary: string
  entryPoints: FlowEntryPoint[]
  steps: ViewStep[]
  replay: ViewReplay
}

export interface ViewDiagnostic {
  code:
    | "canonicalized-reference"
    | "replay-incomplete-selector"
    | "replay-unavailable"
    | "ambiguous-decision-target"
  message: string
  flowId?: string
  screenId?: string
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
    replayAvailable: number
    replayUnavailable: number
    coveredScreens: number
    uncoveredScreens: number
    unaccountedScreens: number
  }
  coverage: {
    covered: string[]
    uncovered: Record<string, string>
    unaccounted: string[]
  }
  diagnostics: ViewDiagnostic[]
}
