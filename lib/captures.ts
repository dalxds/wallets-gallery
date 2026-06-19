// Server-only capture reads, shared by every /apps route (gallery, screen/flow
// pages + modals, and the OG image routes). All data is on disk at build time;
// these read the generated index.json + per-capture view.json. Importing this in
// a Client Component will fail (node:fs) — pass the data down as props instead.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { cache } from "react"
import type {
  AppCapture,
  AppIndex,
  AppsRegistry,
  FlowEntry,
  ScreenEntry,
} from "@/lib/types"

const capturesDir = join(process.cwd(), "public/captures")

// The resolved capture context for a route: the app's registry entry, the view,
// and the resolved date (the passed date, or the latest when omitted).
export type CaptureContext = {
  app: AppIndex
  view: AppCapture
  date: string
  latest: string
}

// cache() dedupes the read + parse within a single request. One screen/flow
// request resolves the same capture from the page body, generateMetadata, and
// the OG route independently — without this, index.json / view.json would be
// read and JSON-parsed ~3× per request instead of once.
export const readRegistry = cache(
  (): AppsRegistry =>
    JSON.parse(
      readFileSync(join(capturesDir, "index.json"), "utf8")
    ) as AppsRegistry
)

export function appIndexOf(slug: string): AppIndex | undefined {
  return readRegistry().apps.find((a) => a.slug === slug)
}

// A specific capture's view. Returns null ONLY when the file is genuinely absent
// (an unknown date → the caller 404s). A present-but-corrupt view.json throws so
// stale/truncated data fails loudly instead of silently rendering a 404.
export const readView = cache(
  (slug: string, date: string): AppCapture | null => {
    const path = join(capturesDir, slug, date, "view.json")
    let raw: string
    try {
      raw = readFileSync(path, "utf8")
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null
      throw new Error(
        `Cannot read view.json for "${slug}" at ${date} (${path}) — run build-data.`,
        { cause: e }
      )
    }
    try {
      return JSON.parse(raw) as AppCapture
    } catch (e) {
      throw new Error(
        `Corrupt view.json for "${slug}" at ${date} (${path}) — re-run build-data.`,
        { cause: e }
      )
    }
  }
)

// Resolve the capture context for a route. Returns null when the app is unknown
// or a requested historical date has no view on disk (→ 404). A MISSING latest
// is a build/data bug, not a 404: the registry lists the app, so its latest
// capture must exist — so it throws instead of silently 404ing the app's home.
export function resolveCapture(
  slug: string,
  date?: string
): CaptureContext | null {
  const app = appIndexOf(slug)
  if (!app) return null
  const resolved = date ?? app.latest
  const view = readView(slug, resolved)
  if (!view) {
    if (resolved === app.latest)
      throw new Error(
        `Missing view.json for "${slug}" at latest capture ${resolved} — run build-data.`
      )
    return null
  }
  return { app, view, date: resolved, latest: app.latest }
}

// Resolve a single screen / flow within a capture, or null when the app, date,
// or entity is unknown. One lookup + one 404 policy shared by the page, the
// @modal intercept, and the OG route — so they can never disagree on existence.
export function resolveScreen(
  slug: string,
  screenId: string,
  date?: string
): { cap: CaptureContext; screen: ScreenEntry } | null {
  const cap = resolveCapture(slug, date)
  if (!cap) return null
  const screen = cap.view.screens.find((s) => s.id === screenId)
  return screen ? { cap, screen } : null
}

export function resolveFlow(
  slug: string,
  flowSlug: string,
  date?: string
): { cap: CaptureContext; flow: FlowEntry } | null {
  const cap = resolveCapture(slug, date)
  if (!cap) return null
  const flow = cap.view.flows.find((f) => f.slug === flowSlug)
  return flow ? { cap, flow } : null
}
