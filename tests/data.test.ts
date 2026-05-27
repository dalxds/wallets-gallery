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
  it("fetches manifest and capture then merges app metadata", async () => {
    const manifest = {
      app: { name: "Phantom", slug: "phantom", bundleId: "app.phantom", platform: "ios" },
      latestCapture: "2026-04-01",
      captures: [],
    }
    const capture = { screens: [], flows: [], decisionPoints: [] }
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith("app.json")) return Promise.resolve(mockJsonResponse(manifest))
      if (url.endsWith("capture.json")) return Promise.resolve(mockJsonResponse(capture))
      return Promise.reject(new Error(`unexpected fetch: ${url}`))
    })

    const result = await fetchAppCapture("phantom", "2026-04-01")

    expect(mockFetch).toHaveBeenCalledWith("/captures/phantom/app.json")
    expect(mockFetch).toHaveBeenCalledWith("/captures/phantom/2026-04-01/capture.json")
    expect(result.app).toEqual(manifest.app)
    expect(result.screens).toEqual([])
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
