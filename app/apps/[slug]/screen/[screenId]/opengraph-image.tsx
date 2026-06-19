import { resolveScreen } from "@/lib/captures"
import { screenOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt = "Screen preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; screenId: string }>
}) {
  const { slug, screenId } = await params
  // 404 when the screen is unknown — matching the page, so a card is never
  // served for a URL that renders a 404.
  const res = resolveScreen(slug, screenId)
  if (!res) return new Response("Not found", { status: 404 })
  return screenOgImage(res.cap.view, res.screen, slug)
}
