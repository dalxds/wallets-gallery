import { readCaptureFile, staticCaptureParams } from "@/lib/captures"

// Public data route: a capture's source graph, served byte-identical to the
// committed graph.json. Canonical at the DATED URL (mirrors the gallery); the
// un-dated /apps/[slug]/graph.json 307s here for the latest. Prerendered per known
// capture (generateStaticParams) and force-static, so the bytes are baked into the
// build output — the route never reads disk at request time, which is what lets
// .vercelignore drop the raw /captures copy without breaking this.
export const dynamic = "force-static"
export const dynamicParams = false
export { staticCaptureParams as generateStaticParams }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; date: string }> }
) {
  const { slug, date } = await params
  const body = readCaptureFile(slug, date, "graph.json")
  if (body == null) return new Response("Not found", { status: 404 })
  return new Response(body, {
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
