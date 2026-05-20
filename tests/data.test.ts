import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getAppsIndex,
  fetchAppCapture,
  fetchSearchIndex,
} from "@/lib/data"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function mockJsonResponse(data: unknown) {
  return { json: () => Promise.resolve(data) }
}

describe("getAppsIndex", () => {
  it("fetches from /captures/index.json", async () => {
    const registry = { apps: [{ slug: "phantom", name: "Phantom" }] }
    mockFetch.mockResolvedValue(mockJsonResponse(registry))

    const result = await getAppsIndex()

    expect(mockFetch).toHaveBeenCalledWith("/captures/index.json")
    expect(result).toEqual(registry)
  })
})

describe("fetchAppCapture", () => {
  it("fetches from /captures/{slug}/{date}/app.json", async () => {
    const capture = { app: { name: "Phantom" }, screens: [] }
    mockFetch.mockResolvedValue(mockJsonResponse(capture))

    const result = await fetchAppCapture("phantom", "2026-04-01")

    expect(mockFetch).toHaveBeenCalledWith(
      "/captures/phantom/2026-04-01/app.json"
    )
    expect(result).toEqual(capture)
  })
})

describe("fetchSearchIndex", () => {
  it("fetches from /captures/search-index.json", async () => {
    const entries = [{ type: "app", label: "Phantom" }]
    mockFetch.mockResolvedValue(mockJsonResponse(entries))

    const result = await fetchSearchIndex()

    expect(mockFetch).toHaveBeenCalledWith("/captures/search-index.json")
    expect(result).toEqual(entries)
  })
})
