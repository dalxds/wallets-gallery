import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { readRegistry, resolveCapture, resolveFlow } from "@/lib/captures"
import { parseStepParam } from "@/lib/links"
import { FlowPage } from "@/components/standalone/flow-page"

// Standalone flow page (latest capture). Rendered on a direct/shared/refreshed
// visit; in-app the @modal slot intercepts this route into a lightbox instead.
export const dynamicParams = true
export const revalidate = false

export function generateStaticParams() {
  const out: { slug: string; flowSlug: string }[] = []
  for (const app of readRegistry().apps) {
    const cap = resolveCapture(app.slug)
    if (!cap) continue
    for (const f of cap.view.flows.slice(0, 3))
      out.push({ slug: app.slug, flowSlug: f.slug })
  }
  return out
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; flowSlug: string }>
}): Promise<Metadata> {
  const { slug, flowSlug } = await params
  const res = resolveFlow(slug, flowSlug)
  if (!res) return {}
  const { cap, flow } = res
  const title = `${flow.name} — ${cap.view.app.name} — Wallets Gallery`
  const description =
    flow.summary ||
    `The ${flow.name} flow in ${cap.view.app.name} — ${flow.steps.length} screens.`
  return { title, description, openGraph: { title, description } }
}

export default async function FlowStandalonePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; flowSlug: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { slug, flowSlug } = await params
  const { step } = await searchParams
  const res = resolveFlow(slug, flowSlug)
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
