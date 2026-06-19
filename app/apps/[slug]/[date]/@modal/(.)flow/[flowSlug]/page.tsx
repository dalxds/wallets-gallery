import { notFound } from "next/navigation"
import { resolveFlow } from "@/lib/captures"
import { parseStepParam } from "@/lib/links"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"

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
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) notFound()
  const { cap, flow } = res
  return (
    <FlowLightbox
      flow={flow}
      screens={cap.view.screens}
      appSlug={slug}
      appName={cap.view.app.name}
      date={cap.date}
      latest={cap.latest}
      initialIndex={parseStepParam(step, flow.steps.length)}
    />
  )
}
