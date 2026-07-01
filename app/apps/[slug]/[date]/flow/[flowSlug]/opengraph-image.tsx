import { resolveFlow } from "@/lib/captures"
import { flowOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
// Cache the composited card forever: it's keyed by an immutable, content-addressed
// flow and renders on demand (no generateStaticParams → never ~50k at build).
export const revalidate = false
export const size = ogSize
export const contentType = ogContentType
export const alt = "Flow preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}) {
  const { slug, date, flowSlug } = await params
  // 404 when the flow is unknown — matching the page, so a card is never served
  // for a URL that renders a 404.
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) return new Response("Not found", { status: 404 })
  return await flowOgImage(res.cap.view, res.flow, slug, res.cap.app.logo)
}
