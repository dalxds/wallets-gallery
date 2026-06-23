import { resolveCapture } from "@/lib/captures"
import { appOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
// Cache the composited card forever: the cover is content-addressed and the card
// renders on demand.
export const revalidate = false
export const size = ogSize
export const contentType = ogContentType
export const alt = "App preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // 404 for an unknown app — matching the page (which 404s), so a card is never
  // served for a URL that renders a 404.
  const cap = resolveCapture(slug)
  if (!cap) return new Response("Not found", { status: 404 })
  return await appOgImage(cap.view, slug)
}
