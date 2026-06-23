import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { FlowsView } from "@/components/app-detail/flows-view"

// The Flows tab of a capture, at /apps/[slug]/[date]/flows — the canonical dated
// URL for every capture (including the latest). Mirrors the dated Screens tab:
// every known date prerendered, unknown dates render on demand → notFound().
export const dynamicParams = true
export { staticCaptureParams as generateStaticParams } from "@/lib/captures"

export default async function DatedFlowsTab({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  return <FlowsView app={cap.view} appSlug={slug} date={cap.date} />
}
