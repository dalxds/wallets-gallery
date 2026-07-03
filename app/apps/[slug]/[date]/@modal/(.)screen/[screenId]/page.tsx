import { notFound } from "next/navigation"
import { resolveScreen } from "@/lib/captures"
import { toClientScreens, toClientFlows } from "@/lib/client-view"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"

// Intercepts /apps/[slug]/[date]/screen/[id] on in-app navigation → modal.
export default async function ScreenModalRoute({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}) {
  const { slug, date, screenId } = await params
  const res = resolveScreen(slug, screenId, date)
  if (!res) notFound()
  const { cap } = res
  return (
    <ScreenLightbox
      screens={toClientScreens(cap.view.screens)}
      flows={toClientFlows(cap.view.flows)}
      activeScreenId={screenId}
      appSlug={slug}
      appName={cap.view.app.name}
      appLogo={cap.app.logo}
      date={cap.date}
    />
  )
}
