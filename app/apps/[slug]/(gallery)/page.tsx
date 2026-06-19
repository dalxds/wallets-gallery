import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { ScreensGrid } from "@/components/app-detail/screens-grid"

// The Screens tab (latest capture), at the clean /apps/[slug]. The chrome is the
// (gallery) layout; this page is just the panel. Prerendered for every app; the
// fixed slug set means no on-demand rendering.
export const dynamicParams = false
export { staticAppParams as generateStaticParams } from "@/lib/captures"

export default async function ScreensTab({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cap = resolveCapture(slug)
  if (!cap) notFound()
  return (
    <ScreensGrid
      screens={cap.view.screens}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
