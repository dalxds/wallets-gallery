import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Suspense } from "react"
import type { Metadata } from "next"
import type { AppsRegistry } from "@/lib/types"
import { AppDetailClient } from "./app-detail-client"
import { AppDetailSkeleton } from "./app-detail-skeleton"

// Every app in the registry is prerendered to static HTML at build time; the
// client component then fetches the capture's view.json on mount. The set of
// apps is fixed by index.json, so unknown slugs 404 rather than render on demand.
export const dynamicParams = false

function readRegistry(): AppsRegistry {
  const indexPath = join(process.cwd(), "public/captures/index.json")
  return JSON.parse(readFileSync(indexPath, "utf8")) as AppsRegistry
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
  const description = `Captured ${app.platform.toUpperCase()} UI — screens and flows for ${app.name}.`
  return { title, description, openGraph: { title, description } }
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <Suspense fallback={<AppDetailSkeleton />}>
      <AppDetailClient slug={slug} />
    </Suspense>
  )
}
