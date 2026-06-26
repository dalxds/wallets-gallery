import { readRegistryFile } from "@/lib/captures"

// Public data route: the app registry, served verbatim at /index.json (root). The
// gallery itself reads the same file off disk (readRegistry) — this is just the
// published copy. force-static bakes the bytes into the build output.
export const dynamic = "force-static"

export async function GET() {
  return new Response(readRegistryFile(), {
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
