import type { AppCapture, AppsRegistry, SearchEntry } from "./types"

const BASE = "/captures"

export async function getAppsIndex(): Promise<AppsRegistry> {
  const res = await fetch(`${BASE}/index.json`)
  return res.json()
}

// Fetches the derived view for one capture. view.json is generated at build time
// by the packager from graph.json (the single source of truth); it already carries
// app metadata, so no manifest merge is needed.
export async function fetchAppCapture(slug: string, date: string): Promise<AppCapture> {
  const res = await fetch(`${BASE}/${slug}/${date}/view.json`)
  return res.json()
}

export async function fetchSearchIndex(): Promise<SearchEntry[]> {
  const res = await fetch(`${BASE}/search-index.json`)
  return res.json()
}
