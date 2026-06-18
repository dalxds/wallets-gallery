import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { ScreenModal } from "@/components/lightbox/screen-modal"

// Intercepts /apps/[slug]/screen/[id] on in-app (soft) navigation → renders the
// lightbox as a modal over the gallery. A direct/refreshed visit bypasses this
// and renders screen/[screenId]/page.tsx (the standalone page).
export default async function ScreenModalRoute({
  params,
}: {
  params: Promise<{ slug: string; screenId: string }>
}) {
  const { slug, screenId } = await params
  const cap = resolveCapture(slug)
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
