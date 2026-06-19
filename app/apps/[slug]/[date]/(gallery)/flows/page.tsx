import { notFound, redirect } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { flowsHref } from "@/lib/links"
import { FlowsView } from "@/components/app-detail/flows-view"

// The Flows tab of a historical capture, at /apps/[slug]/[date]/flows. Mirrors
// the dated Screens tab: non-latest dates prerendered, the latest's dated URL
// renders on demand to redirect to the clean /apps/[slug]/flows.
export const dynamicParams = true
export { staticDateParams as generateStaticParams } from "@/lib/captures"

export default async function DatedFlowsTab({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  if (cap.date === cap.latest) redirect(flowsHref(slug, cap.latest, cap.latest))
  return (
    <FlowsView
      app={cap.view}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
