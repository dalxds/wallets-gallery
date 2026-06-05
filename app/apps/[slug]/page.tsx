import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Suspense } from "react"
import type { AppsRegistry } from "@/lib/types"
import { AppDetailClient } from "./app-detail-client"
import { AppDetailSkeleton } from "./app-detail-skeleton"

// Every app in the registry is prerendered to static HTML at build time; the
// client component then fetches the capture's view.json on mount. The set of
// apps is fixed by index.json, so unknown slugs 404 rather than render on demand.
export const dynamicParams = false

export function generateStaticParams() {
  const indexPath = join(process.cwd(), "public/captures/index.json")
  const registry = JSON.parse(readFileSync(indexPath, "utf8")) as AppsRegistry
  return registry.apps.map((app) => ({ slug: app.slug }))
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
