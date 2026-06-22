import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { ScreensGrid } from "@/components/app-detail/screens-grid"

// The Screens tab of a capture, at /apps/[slug]/[date] — the canonical dated URL
// for every capture (including the latest). Every known date is prerendered;
// unknown dates render on demand → notFound().
export const dynamicParams = true
export { staticCaptureParams as generateStaticParams } from "@/lib/captures"

export default async function DatedScreensTab({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  return (
    <ScreensGrid screens={cap.view.screens} appSlug={slug} date={cap.date} />
  )
}
