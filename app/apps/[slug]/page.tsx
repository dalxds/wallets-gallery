import { notFound, redirect } from "next/navigation"
import { appIndexOf, staticAppParams } from "@/lib/captures"
import { captureBase } from "@/lib/links"

// /apps/[slug] has no gallery of its own — every capture is canonical at its
// DATED URL (/apps/[slug]/<date>). This bare route is a prebuilt redirect to the
// latest capture: dynamicParams = false + generateStaticParams = staticAppParams
// bakes one static 307 per known app at build, with the target read from
// app.latest. It's a 307 (temporary), not 308, because "latest" moves — a newer
// capture changes where this points, so the redirect must not be cached as
// permanent. No generateMetadata: a redirecting page renders no HTML (the dated
// gallery it lands on carries the metadata + the inherited app OG card).
export const dynamicParams = false
export { staticAppParams as generateStaticParams }

export default async function AppLatestRedirect({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const app = appIndexOf(slug)
  if (!app) notFound()
  redirect(captureBase(slug, app.latest)) // 307 → /apps/[slug]/<latest>
}
