import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { resolveCapture } from "@/lib/captures"
import { FlowPage } from "@/components/standalone/flow-page"

// Standalone flow page for a historical capture. Render on demand + cache.
export const dynamicParams = true
export const revalidate = false

export function generateStaticParams() {
  return [] as { slug: string; date: string; flowSlug: string }[]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}): Promise<Metadata> {
  const { slug, date, flowSlug } = await params
  const cap = resolveCapture(slug, date)
  const flow = cap?.view.flows.find((f) => f.slug === flowSlug)
  if (!cap || !flow) return {}
  const title = `${flow.name} — ${cap.view.app.name} (${date}) — Wallets Gallery`
  const description =
    flow.summary ||
    `The ${flow.name} flow in ${cap.view.app.name} (${date}) — ${flow.steps.length} screens.`
  return { title, description, openGraph: { title, description } }
}

export default async function FlowStandalonePage({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}) {
  const { slug, date, flowSlug } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  const flow = cap.view.flows.find((f) => f.slug === flowSlug)
  if (!flow) notFound()
  return (
    <FlowPage
      view={cap.view}
      flow={flow}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
