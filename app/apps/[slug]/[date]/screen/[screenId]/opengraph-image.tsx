import { resolveCapture } from "@/lib/captures"
import { screenOgImage, appOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt = "Screen preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; date: string; screenId: string }>
}) {
  const { slug, date, screenId } = await params
  const cap = resolveCapture(slug, date)
  const screen = cap?.view.screens.find((s) => s.id === screenId)
  if (cap && screen) return screenOgImage(cap.view, screen, slug)
  return cap
    ? appOgImage(cap.view, slug)
    : new Response("Not found", { status: 404 })
}
