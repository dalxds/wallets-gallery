import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { readRegistry, resolveCapture } from "@/lib/captures"
import { ScreenPage } from "@/components/standalone/screen-page"

// Standalone screen page (latest capture). Rendered on a direct/shared/refreshed
// visit; in-app the @modal slot intercepts this route into a lightbox instead.
export const dynamicParams = true
export const revalidate = false

export function generateStaticParams() {
  // Prebuild only a few screens per app for crawl warmth; the rest render on the
  // first request and cache — never ~50k pages at build.
  const out: { slug: string; screenId: string }[] = []
  for (const app of readRegistry().apps) {
    const cap = resolveCapture(app.slug)
    if (!cap) continue
    for (const s of cap.view.screens.slice(0, 3))
      out.push({ slug: app.slug, screenId: s.id })
  }
  return out
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; screenId: string }>
}): Promise<Metadata> {
  const { slug, screenId } = await params
  const cap = resolveCapture(slug)
  const screen = cap?.view.screens.find((s) => s.id === screenId)
  if (!cap || !screen) return {}
  const title = `${screen.title} — ${cap.view.app.name} — Wallets Gallery`
  const description =
    screen.description || `${screen.title} in ${cap.view.app.name}.`
  return { title, description, openGraph: { title, description } }
}

export default async function ScreenStandalonePage({
  params,
}: {
  params: Promise<{ slug: string; screenId: string }>
}) {
  const { slug, screenId } = await params
  const cap = resolveCapture(slug)
  if (!cap) notFound()
  const screen = cap.view.screens.find((s) => s.id === screenId)
  if (!screen) notFound()
  return (
    <ScreenPage
      view={cap.view}
      screen={screen}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
