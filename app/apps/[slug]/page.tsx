import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Suspense } from "react"
import type { Metadata } from "next"
import type { AppCapture, AppIndex, AppsRegistry } from "@/lib/types"
import { AppDetailClient } from "./app-detail-client"
import { AppDetailStatic } from "./app-detail-static"

// Every app in the registry is prerendered to static HTML at build time. The
// set of apps is fixed by index.json, so unknown slugs 404 rather than render
// on demand.
export const dynamicParams = false

const capturesDir = join(process.cwd(), "public/captures")

function readRegistry(): AppsRegistry {
  return JSON.parse(readFileSync(join(capturesDir, "index.json"), "utf8")) as AppsRegistry
}

// Read the app's index entry + its latest capture view at build time, so both
// the static fallback and the client render from data already in the bundle —
// no client-side fetch, no loading flash on first paint.
function readCapture(slug: string): { appIndex: AppIndex; view: AppCapture } | null {
  const appIndex = readRegistry().apps.find((a) => a.slug === slug)
  if (!appIndex) return null
  const viewPath = join(capturesDir, slug, appIndex.latest, "view.json")
  try {
    const view = JSON.parse(readFileSync(viewPath, "utf8")) as AppCapture
    return { appIndex, view }
  } catch (e) {
    // build-data.ts guarantees the latest view exists; if it somehow doesn't, fail
    // with a pointer to the cause instead of a bare ENOENT partway through export.
    throw new Error(`Missing view.json for "${slug}" at ${appIndex.latest} (${viewPath}) — run build-data. Cause: ${e}`)
  }
}

export function generateStaticParams() {
  return readRegistry().apps.map((app) => ({ slug: app.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const app = readRegistry().apps.find((a) => a.slug === slug)
  if (!app) return {}
  const title = `${app.name} — Inspo`
  const description = `Captured ${app.platform.toUpperCase()} UI — ${app.screens} screens and ${app.flows} flows for ${app.name}.`
  return { title, description, openGraph: { title, description } }
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = readCapture(slug)
  if (!data) return null // unreachable: dynamicParams=false restricts to known slugs

  return (
    <Suspense
      fallback={
        <AppDetailStatic view={data.view} appIndex={data.appIndex} appSlug={slug} />
      }
    >
      <AppDetailClient
        slug={slug}
        initialView={data.view}
        initialAppIndex={data.appIndex}
      />
    </Suspense>
  )
}
