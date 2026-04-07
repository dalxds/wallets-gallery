import type {
  AppCapture,
  AppsRegistry,
  FlowDetail,
  NavigationGraph,
  SearchEntry,
} from "./types"

const BASE = "/captures"

export async function getAppsIndex(): Promise<AppsRegistry> {
  const res = await fetch(`${BASE}/index.json`)
  return res.json()
}

export async function fetchAppCapture(
  slug: string,
  date: string
): Promise<AppCapture> {
  const res = await fetch(`${BASE}/${slug}/${date}/app.json`)
  return res.json()
}

export async function fetchFlow(
  slug: string,
  date: string,
  flowPath: string
): Promise<FlowDetail> {
  const res = await fetch(`${BASE}/${slug}/${date}/${flowPath}`)
  return res.json()
}

export async function fetchNavigation(
  slug: string,
  date: string
): Promise<NavigationGraph> {
  const res = await fetch(`${BASE}/${slug}/${date}/navigation.json`)
  return res.json()
}

export async function fetchSearchIndex(): Promise<SearchEntry[]> {
  const res = await fetch(`${BASE}/search-index.json`)
  return res.json()
}
