import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Metadata } from "next"
import type { AppCapture, AppIndex, AppsRegistry } from "@/lib/types"
import { AppDetail } from "../app-detail"

// One route for the app detail. The optional catch-all date segment means the
// latest capture lives at the clean /apps/[slug] (date segment absent) and every
// other capture at /apps/[slug]/[date] — each its own prerendered page, read from
// view.json at build time. The set of slug/date pairs is fixed, so anything else
// 404s rather than rendering on demand.
export const dynamicParams = false

const capturesDir = join(process.cwd(), "public/captures")

function readRegistry(): AppsRegistry {
  return JSON.parse(readFileSync(join(capturesDir, "index.json"), "utf8")) as AppsRegistry
}

function readCapture(
  slug: string,
  dateSeg?: string[]
): { appIndex: AppIndex; view: AppCapture; date: string } | null {
  const appIndex = readRegistry().apps.find((a) => a.slug === slug)
  if (!appIndex) return null
  const date = dateSeg?.[0] ?? appIndex.latest
  const viewPath = join(capturesDir, slug, date, "view.json")
  try {
    const view = JSON.parse(readFileSync(viewPath, "utf8")) as AppCapture
    return { appIndex, view, date }
  } catch (e) {
    // build-data.ts guarantees every captured date has a view; if one is missing,
    // fail with a pointer to the cause instead of a bare ENOENT mid-export.
    throw new Error(`Missing view.json for "${slug}" at ${date} (${viewPath}) — run build-data. Cause: ${e}`)
  }
}

export function generateStaticParams() {
  // `date: []` → the latest at /apps/[slug]; every non-latest capture gets its
  // own /apps/[slug]/[date] page.
  const params: { slug: string; date: string[] }[] = []
  for (const app of readRegistry().apps) {
    params.push({ slug: app.slug, date: [] })
    for (const date of app.captures) {
      if (date !== app.latest) params.push({ slug: app.slug, date: [date] })
    }
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date?: string[] }>
}): Promise<Metadata> {
  const { slug, date } = await params
  const app = readRegistry().apps.find((a) => a.slug === slug)
  if (!app) return {}
  const d = date?.[0]
  const title = d ? `${app.name} (${d}) — Wallets Gallery` : `${app.name} — Wallets Gallery`
  const description = d
    ? `Captured ${app.platform.toUpperCase()} UI for ${app.name} — ${d} capture.`
    : `Captured ${app.platform.toUpperCase()} UI — ${app.screens} screens and ${app.flows} flows for ${app.name}.`
  return { title, description, openGraph: { title, description } }
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string; date?: string[] }>
}) {
  const { slug, date } = await params
  const data = readCapture(slug, date)
  if (!data) return null // unreachable: dynamicParams=false restricts to known slugs

  return (
    <AppDetail
      slug={slug}
      view={data.view}
      appIndex={data.appIndex}
      date={data.date}
    />
  )
}
