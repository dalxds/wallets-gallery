import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"

function parseStep(v: string | undefined): number {
  const n = v ? parseInt(v, 10) : 0
  return Number.isNaN(n) ? 0 : n
}

// Intercepts /apps/[slug]/[date]/flow/[slug]?step=N on in-app navigation → modal.
export default async function FlowModalRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
  searchParams: Promise<{ step?: string }>
}) {
  const { slug, date, flowSlug } = await params
  const { step } = await searchParams
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  const flow = cap.view.flows.find((f) => f.slug === flowSlug)
  if (!flow) notFound()
  return (
    <FlowLightbox
      flow={flow}
      screens={cap.view.screens}
      appSlug={slug}
      appName={cap.view.app.name}
      date={cap.date}
      initialIndex={parseStep(step)}
    />
  )
}
