// Matches the app-capture skill's schema (references/schema.md)

export interface AppMeta {
  name: string
  slug: string
  bundleId: string
  platform: "ios" | "android"
}

export interface InteractiveElement {
  label: string
  role: string
  selector: string | null
}

export interface EntryPath {
  description: string
  via?: string
  fromScreen?: string
  action?: string
}

export interface ScreenEntry {
  id: string
  title: string
  role: string
  description: string
  screenshotPath: string
  fingerprint: string
  texts: string[]
  primaryCta: InteractiveElement | null
  secondaryCtas: InteractiveElement[]
  interactiveElements: InteractiveElement[]
  entryPaths: EntryPath[]
  appearsIn: { flow: string; step: number }[]
  _humanEdited: string[]
}

export interface FlowStep {
  number: number
  title: string
  screenId: string
  action: string
  description: string
  screenshotPath: string
  selector: string | null
  fingerprintBefore: string
  fingerprintAfter: string
}

export interface FlowReplay {
  path: string
  entryFingerprint: string
  confidence: "high" | "medium" | "low"
  credentialsTemplate: string[]
}

export interface FlowEntry {
  slug: string
  name: string
  parent: string | null
  summary: string
  mode: string
  entryPoints: string[]
  replay: FlowReplay | null
  steps: FlowStep[]
  notes: string
  _humanEdited: string[]
}

export interface DecisionPointOption {
  label: string
  explored: boolean
  flowSlug?: string
  note?: string
}

export interface DecisionPoint {
  screenId: string
  options: DecisionPointOption[]
}

export interface ChangeEntry {
  kind: string
  screen?: string
  flow?: string
  fromFingerprint?: string
  toFingerprint?: string
  details?: Record<string, unknown>[]
}

export interface CaptureStats {
  screensInThisCapture: number
  screensVisited: number
  screensAdded: number
  screensModified: number
  screensRemoved: number
  flowsTouched: number
}

export interface AppCapture {
  schemaVersion: number
  app: AppMeta
  captureDate: string
  scope: string
  flowsRecaptured: string[] | null
  previousCapture: string | null
  mode: string
  durationSeconds: number
  screens: ScreenEntry[]
  flows: FlowEntry[]
  decisionPoints: DecisionPoint[]
  changes: ChangeEntry[]
  stats: CaptureStats
}

// App manifest (per-app app.json from capture skill)
export interface CaptureIndexEntry {
  date: string
  scope: string
  flowsRecaptured?: string[]
  mode: string
  previousCapture: string | null
  path: string
}

export interface AppManifest {
  schemaVersion: number
  app: AppMeta
  firstCapturedAt: string
  lastCapturedAt: string
  latestCapture: string
  captures: CaptureIndexEntry[]
}

// Global registry (index.json — derived by ingestion script)
export interface AppIndex {
  slug: string
  name: string
  platform: "ios" | "android"
  captures: string[]
  latest: string
}

export interface AppsRegistry {
  apps: AppIndex[]
}

// Search index
export interface SearchEntry {
  type: "app" | "screen" | "flow" | "step"
  appSlug: string
  appName: string
  label: string
  description: string
  href: string
  screenId?: string
  flowSlug?: string
  flowName?: string
}
