import { appIndexOf, staticAppParams } from "@/lib/captures"

// /apps/[slug]/view.json has no canonical content of its own — every capture's
// view is canonical at its DATED URL. This 307s to the latest dated view,
// mirroring the bare /apps/[slug] page redirect. 307 (not 308) because "latest"
// moves: a newer capture repoints it, so it must not be cached as permanent. The
// root-relative Location keeps it host-agnostic. dynamicParams = false +
// staticAppParams bakes one redirect per known app at build.
export const dynamicParams = false
export { staticAppParams as generateStaticParams }

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const app = appIndexOf(slug)
  if (!app) return new Response("Not found", { status: 404 })
  return new Response(null, {
    status: 307,
    headers: { location: `/apps/${slug}/${app.latest}/view.json` },
  })
}
