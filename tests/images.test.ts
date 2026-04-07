import { describe, it, expect } from "vitest"
import { captureUrl } from "@/lib/images"

describe("captureUrl", () => {
  it("builds correct URL from slug, date, and path", () => {
    expect(captureUrl("phantom", "2026-04-01", "screenshots/home.png")).toBe(
      "/captures/phantom/2026-04-01/screenshots/home.png"
    )
  })

  it("handles nested relative paths", () => {
    expect(
      captureUrl("coinbase", "2025-12-15", "flows/send/step-1.png")
    ).toBe("/captures/coinbase/2025-12-15/flows/send/step-1.png")
  })

  it("handles simple filename", () => {
    expect(captureUrl("myapp", "2026-01-01", "app.json")).toBe(
      "/captures/myapp/2026-01-01/app.json"
    )
  })
})
