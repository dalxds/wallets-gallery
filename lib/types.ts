// From app.json
export interface AppMeta {
  name: string
  slug: string
  bundleId: string
  platform: "ios" | "android"
}

export interface ScreenEntry {
  id: string
  description: string
  screenshotPath: string
  snapshotPath?: string | null
}

export interface FlowEntry {
  slug: string
  name: string
  parent?: string | null
  summary: string
  stepsCount: number
  path: string
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

export interface AppCapture {
  app: AppMeta
  captureDate: string
  mode: string
  screens: ScreenEntry[]
  flows: FlowEntry[]
  decisionPoints: DecisionPoint[]
  sitemapPath: string
}

// From flow.json
export interface FlowStep {
  number: number
  title: string
  screenId: string
  action: string
  description: string
  screenshotPath: string
  changes?: string | null
}

export interface FlowDetail {
  slug: string
  name: string
  parent?: string | null
  summary: string
  steps: FlowStep[]
  notes?: string
}

// From navigation.json
export interface NavigationScreen {
  id: string
  description: string
}

export interface NavigationTransition {
  from: string
  to: string
  action: string
}

export interface NavigationGraph {
  screens: NavigationScreen[]
  transitions: NavigationTransition[]
}

// App registry (index.json)
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
