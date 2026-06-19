import { resolveFlow } from "@/lib/captures"
import { flowOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
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
  return flowOgImage(res.cap.view, res.flow, slug)
}
