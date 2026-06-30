import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { resolveScreen } from "@/lib/captures"
import { formatDate } from "@/lib/utils"
import { ScreenPage } from "@/components/standalone/screen-page"

// Standalone screen page for a capture. All render on demand and cache; the modal
// handles in-app viewing.
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
  const res = resolveScreen(slug, screenId, date)
  if (!res) return {}
  const { cap, screen } = res
  const title = `wallets.gallery - ${cap.view.app.name}`
  const description = `${screen.title} in ${cap.view.app.name} on ${formatDate(cap.view.captureDate)}`
  return { title, description, openGraph: { title, description } }
}

export default async function ScreenStandalonePage({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}) {
  const { slug, date, screenId } = await params
  const res = resolveScreen(slug, screenId, date)
  if (!res) notFound()
  const { cap, screen } = res
  return (
    <ScreenPage
      view={cap.view}
      screen={screen}
      appSlug={slug}
      date={cap.date}
    />
  )
}
