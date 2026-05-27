import { describe, it, expect } from "vitest"
import { captureUrl } from "@/lib/images"

describe("captureUrl", () => {
  it("builds correct URL from slug and relative path", () => {
    expect(captureUrl("phantom", "assets/abc123.png")).toBe(
      "/captures/phantom/assets/abc123.png"
    )
  })

  it("handles nested relative paths", () => {
    expect(captureUrl("coinbase", "assets/f8533c79ce1b.png")).toBe(
      "/captures/coinbase/assets/f8533c79ce1b.png"
    )
  })

  it("handles simple filename", () => {
    expect(captureUrl("myapp", "app.json")).toBe("/captures/myapp/app.json")
  })
})
