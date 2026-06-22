import { notFound } from "next/navigation"
import { resolveFlow } from "@/lib/captures"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"

// Intercepts /apps/[slug]/[date]/flow/[slug] on in-app navigation → modal. The
// ?step deep-link is read client-side in FlowViewer (so this slot doesn't depend
// on searchParams), matching the standalone page.
export default async function FlowModalRoute({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}) {
  const { slug, date, flowSlug } = await params
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
    />
  )
}
