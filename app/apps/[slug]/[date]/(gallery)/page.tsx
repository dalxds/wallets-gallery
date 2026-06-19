import { notFound, redirect } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { appHref } from "@/lib/links"
import { ScreensGrid } from "@/components/app-detail/screens-grid"

// The Screens tab of a historical capture, at /apps/[slug]/[date]. Non-latest
// dates are prerendered; the latest's dated URL renders on demand only to run the
// canonical redirect to the clean /apps/[slug] (see [date] note). Unknown dates
// render on demand → notFound().
export const dynamicParams = true
export { staticDateParams as generateStaticParams } from "@/lib/captures"

export default async function DatedScreensTab({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  // The latest capture's canonical home is the clean /apps/[slug]; send the dated
  // Screens URL there so it isn't a duplicate.
  if (cap.date === cap.latest) redirect(appHref(slug))
  return (
    <ScreensGrid
      screens={cap.view.screens}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
