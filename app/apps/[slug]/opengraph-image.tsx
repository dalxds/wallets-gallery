import { resolveCapture } from "@/lib/captures"
import { appOgImage, siteOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt = "App preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cap = resolveCapture(slug)
  return cap ? appOgImage(cap.view, slug) : siteOgImage()
}
