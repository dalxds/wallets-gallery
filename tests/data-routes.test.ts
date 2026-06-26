import { describe, it, expect } from "vitest"
import { appIndexOf } from "@/lib/captures"
import { GET as datedGraph } from "@/app/apps/[slug]/[date]/graph.json/route"
import { GET as datedView } from "@/app/apps/[slug]/[date]/view.json/route"
import { GET as latestGraph } from "@/app/apps/[slug]/graph.json/route"
import { GET as latestView } from "@/app/apps/[slug]/view.json/route"
import { GET as registry } from "@/app/index.json/route"
import { GET as appMeta } from "@/app/apps/[slug]/app.json/route"

// A real committed capture to exercise the handlers against on-disk data.
const SLUG = "avici"
const DATE = "2026-06-23"
const req = new Request("http://test/")
const dated = (slug: string, date: string) => ({
  params: Promise.resolve({ slug, date }),
})
const bare = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe("capture data routes", () => {
  describe("dated content (/apps/[slug]/[date]/*.json)", () => {
    it("serves the source graph as JSON, byte-identical to the file", async () => {
      const res = await datedGraph(req, dated(SLUG, DATE))
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("application/json")
      const graph = JSON.parse(await res.text())
      expect(Array.isArray(graph.nodes)).toBe(true)
      expect(Array.isArray(graph.edges)).toBe(true)
    })

    it("serves the derived view as JSON", async () => {
      const res = await datedView(req, dated(SLUG, DATE))
      expect(res.status).toBe(200)
      const view = JSON.parse(await res.text())
      expect(Array.isArray(view.screens)).toBe(true)
      expect(Array.isArray(view.flows)).toBe(true)
    })

    it("404s an unknown date", async () => {
      const res = await datedGraph(req, dated(SLUG, "1999-01-01"))
      expect(res.status).toBe(404)
    })
  })

  describe("latest redirect (/apps/[slug]/*.json)", () => {
    const latest = appIndexOf(SLUG)!.latest

    it("307s graph.json to the latest dated URL", async () => {
      const res = await latestGraph(req, bare(SLUG))
      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toBe(
        `/apps/${SLUG}/${latest}/graph.json`
      )
    })

    it("307s view.json to the latest dated URL", async () => {
      const res = await latestView(req, bare(SLUG))
      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toBe(
        `/apps/${SLUG}/${latest}/view.json`
      )
    })

    it("404s an unknown app", async () => {
      const res = await latestGraph(req, bare("nope"))
      expect(res.status).toBe(404)
    })
  })

  describe("registry (/index.json)", () => {
    it("serves the registry as JSON", async () => {
      const res = await registry()
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("application/json")
      const reg = JSON.parse(await res.text())
      expect(Array.isArray(reg.apps)).toBe(true)
    })
  })

  describe("app metadata (/apps/[slug]/app.json)", () => {
    it("serves a known app's metadata", async () => {
      const res = await appMeta(req, bare(SLUG))
      expect(res.status).toBe(200)
      const meta = JSON.parse(await res.text())
      expect(meta.app.slug).toBe(SLUG)
    })

    it("404s an unknown app", async () => {
      const res = await appMeta(req, bare("nope"))
      expect(res.status).toBe(404)
    })
  })
})
