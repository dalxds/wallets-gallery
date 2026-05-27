import type {
  AppCapture,
  AppManifest,
  AppsRegistry,
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
  const [manifestRes, captureRes] = await Promise.all([
    fetch(`${BASE}/${slug}/app.json`),
    fetch(`${BASE}/${slug}/${date}/capture.json`),
  ])
  const manifest: AppManifest = await manifestRes.json()
  const capture = await captureRes.json()
  return { ...capture, app: manifest.app }
}

export async function fetchSearchIndex(): Promise<SearchEntry[]> {
  const res = await fetch(`${BASE}/search-index.json`)
  return res.json()
}
