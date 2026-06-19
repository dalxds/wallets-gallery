import { notFound } from "next/navigation"
import { resolveScreen } from "@/lib/captures"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"

// Intercepts /apps/[slug]/screen/[id] on in-app (soft) navigation → renders the
// lightbox as a modal over the gallery. A direct/refreshed visit bypasses this
// and renders screen/[screenId]/page.tsx (the standalone page).
export default async function ScreenModalRoute({
  params,
}: {
  params: Promise<{ slug: string; screenId: string }>
}) {
  const { slug, screenId } = await params
  const res = resolveScreen(slug, screenId)
  if (!res) notFound()
  const { cap } = res
  return (
    <ScreenLightbox
      screens={cap.view.screens}
      flows={cap.view.flows}
      activeScreenId={screenId}
      appSlug={slug}
      appName={cap.view.app.name}
      date={cap.date}
      latest={cap.latest}
    />
  )
}
