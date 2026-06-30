import fs from "fs"
import path from "path"
import { describe, it, expect } from "vitest"
import nextConfig from "../next.config.mjs"

// The data-side "latest" alias: /captures/<slug>/latest/{view,graph}.json must
// 307 (NOT 308 — "latest" moves) to the newest dated file, one pair per app, with
// the date read from index.json at build time. This pins that contract so it
// can't silently regress (e.g. flip to permanent, or drift off app.latest).
const index = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "public/captures/index.json"),
    "utf-8"
  )
)

describe("latest-data redirects (next.config)", () => {
  it("emits a 307 view.json + graph.json alias for every app, pointing at app.latest", async () => {
    const redirects = await nextConfig.redirects!()

    for (const app of index.apps) {
      for (const file of ["view.json", "graph.json"]) {
        const match = redirects.find(
          (r) => r.source === `/captures/${app.slug}/latest/${file}`
        )
        expect(match, `${app.slug}/latest/${file}`).toBeDefined()
        expect(match!.destination).toBe(
          `/captures/${app.slug}/${app.latest}/${file}`
        )
        // 307, never a cacheable-as-permanent 308.
        expect(match!.permanent).toBe(false)
      }
    }

    // Exactly the pairs we expect — no stray or duplicated rules.
    expect(redirects).toHaveLength(index.apps.length * 2)
  })
})
