import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { resolveFlow } from "@/lib/captures"
import { parseStepParam } from "@/lib/links"
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
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) return {}
  const { cap, flow } = res
  const title = `${flow.name} — ${cap.view.app.name} (${date}) — Wallets Gallery`
  const description =
    flow.summary ||
    `The ${flow.name} flow in ${cap.view.app.name} (${date}) — ${flow.steps.length} screens.`
  return { title, description, openGraph: { title, description } }
}

export default async function FlowStandalonePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { slug, date, flowSlug } = await params
  const { step } = await searchParams
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) notFound()
  const { cap, flow } = res
  return (
    <FlowPage
      view={cap.view}
      flow={flow}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
      initialIndex={parseStepParam(step, flow.steps.length)}
    />
  )
}
