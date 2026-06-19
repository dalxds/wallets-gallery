import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { FlowsView } from "@/components/app-detail/flows-view"

// The Flows tab (latest capture), at /apps/[slug]/flows. Same chrome (the
// (gallery) layout), same capture data — only the panel differs from the Screens
// tab. Prerendered for every app so the tab switch is an instant prefetched
// navigation.
export const dynamicParams = false
export { staticAppParams as generateStaticParams } from "@/lib/captures"

export default async function FlowsTab({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cap = resolveCapture(slug)
  if (!cap) notFound()
  return (
    <FlowsView
      app={cap.view}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
