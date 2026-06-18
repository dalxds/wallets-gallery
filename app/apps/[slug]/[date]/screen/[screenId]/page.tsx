import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { resolveCapture } from "@/lib/captures"
import { ScreenPage } from "@/components/standalone/screen-page"

// Standalone screen page for a historical capture. All render on demand (sharing
// a past capture's screen is rare) and cache; the modal handles in-app viewing.
export const dynamicParams = true
export const revalidate = false

export function generateStaticParams() {
  return [] as { slug: string; date: string; screenId: string }[]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}): Promise<Metadata> {
  const { slug, date, screenId } = await params
  const cap = resolveCapture(slug, date)
  const screen = cap?.view.screens.find((s) => s.id === screenId)
  if (!cap || !screen) return {}
  const title = `${screen.title} — ${cap.view.app.name} (${date}) — Wallets Gallery`
  const description =
    screen.description || `${screen.title} in ${cap.view.app.name} (${date}).`
  return { title, description, openGraph: { title, description } }
}

export default async function ScreenStandalonePage({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}) {
  const { slug, date, screenId } = await params
  const cap = resolveCapture(slug, date)
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
