// Server-only capture reads, shared by every /apps route (gallery, screen/flow
// pages + modals, and the OG image routes). All data is on disk at build time;
// these read the generated index.json + per-capture view.json. Importing this in
// a Client Component will fail (node:fs) — pass the data down as props instead.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppCapture, AppIndex, AppsRegistry } from "@/lib/types"

const capturesDir = join(process.cwd(), "public/captures")

export function readRegistry(): AppsRegistry {
  return JSON.parse(
    readFileSync(join(capturesDir, "index.json"), "utf8")
  ) as AppsRegistry
}

export function appIndexOf(slug: string): AppIndex | undefined {
  return readRegistry().apps.find((a) => a.slug === slug)
}

// A specific capture's view, or null if it isn't on disk. Callers decide whether
// a miss is a 404 (unknown date) or a hard error (latest must always exist).
export function readView(slug: string, date: string): AppCapture | null {
  try {
    return JSON.parse(
      readFileSync(join(capturesDir, slug, date, "view.json"), "utf8")
    ) as AppCapture
  } catch {
    return null
  }
}

// Resolve the capture context for a route: the app's registry entry, the view,
// and the resolved date (the passed date, or the latest when omitted). Returns
// null when the app or the view is missing so the route can notFound().
export function resolveCapture(
  slug: string,
  date?: string
): { app: AppIndex; view: AppCapture; date: string; latest: string } | null {
  const app = appIndexOf(slug)
  if (!app) return null
  const resolved = date ?? app.latest
  const view = readView(slug, resolved)
  if (!view) return null
  return { app, view, date: resolved, latest: app.latest }
}
