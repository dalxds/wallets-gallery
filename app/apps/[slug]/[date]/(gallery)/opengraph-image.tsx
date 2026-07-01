import { resolveCapture } from "@/lib/captures"
import { appOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
// Cache the composited card forever: the cover is content-addressed and the card
// renders on demand. Lives in the (gallery) group — the same segment as the
// layout's generateMetadata — so the file-based image and that openGraph block
// coexist instead of the openGraph block wiping an inherited image. Covers both
// the Screens (/apps/[slug]/[date]) and Flows (…/flows) tabs.
export const revalidate = false
export const size = ogSize
export const contentType = ogContentType
export const alt = "App preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  // 404 for an unknown app/date — matching the page, so a card is never served
  // for a URL that renders a 404.
  const cap = resolveCapture(slug, date)
  if (!cap) return new Response("Not found", { status: 404 })
  return await appOgImage(cap.view, slug, cap.app.logo)
}
