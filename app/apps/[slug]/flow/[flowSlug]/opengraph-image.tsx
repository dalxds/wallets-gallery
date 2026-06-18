import { resolveCapture } from "@/lib/captures"
import { flowOgImage, appOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt = "Flow preview — Wallets Gallery"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; flowSlug: string }>
}) {
  const { slug, flowSlug } = await params
  const cap = resolveCapture(slug)
  const flow = cap?.view.flows.find((f) => f.slug === flowSlug)
  if (cap && flow) return flowOgImage(cap.view, flow, slug)
  return cap
    ? appOgImage(cap.view, slug)
    : new Response("Not found", { status: 404 })
}
