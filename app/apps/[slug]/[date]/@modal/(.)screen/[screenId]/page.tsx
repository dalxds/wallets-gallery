import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { ScreenModal } from "@/components/lightbox/screen-modal"

// Intercepts /apps/[slug]/[date]/screen/[id] on in-app navigation → modal.
export default async function ScreenModalRoute({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}) {
  const { slug, date, screenId } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  if (!cap.view.screens.some((s) => s.id === screenId)) notFound()
  return (
    <ScreenModal
      screens={cap.view.screens}
      flows={cap.view.flows}
      activeScreenId={screenId}
      appSlug={slug}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
