import { readAppFile, staticAppParams } from "@/lib/captures"

// Public data route: a per-app metadata file (app.json), served verbatim at
// /apps/[slug]/app.json — committed source, one per app. Prerendered per known app
// (generateStaticParams) and force-static, so the bytes are baked into the build
// output and the route never reads disk at request time. The literal app.json
// segment outranks the sibling [date], same as graph.json / view.json.
export const dynamic = "force-static"
export const dynamicParams = false
export { staticAppParams as generateStaticParams }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const body = readAppFile(slug)
  if (body == null) return new Response("Not found", { status: 404 })
  return new Response(body, {
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
