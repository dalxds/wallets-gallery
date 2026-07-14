import { describe, expect, it } from "vitest"
import { flowHref, parseStepParam } from "@/lib/links"
import { variationForStep } from "@/lib/variations"

describe("flow links", () => {
  it("normalizes a named variation to lowercase kebab-case", () => {
    expect(flowHref("avici", "card", "2026-06-23", 1, "Issued")).toBe(
      "/apps/avici/2026-06-23/flow/card?step=1&variation=issued"
    )
    expect(flowHref("redotpay", "cards", "2026-06-29", 2, "Promo code")).toBe(
      "/apps/redotpay/2026-06-29/flow/cards?step=2&variation=promo-code"
    )
  })

  it("rejects an empty variation name instead of emitting variation=", () => {
    expect(() => flowHref("avici", "card", "2026-06-23", 1, "   ")).toThrow(
      "variation must have a URL-safe name"
    )
  })

  it("omits query parameters for a flow-level link", () => {
    expect(flowHref("avici", "card", "2026-06-23")).toBe(
      "/apps/avici/2026-06-23/flow/card"
    )
  })
})

describe("flow step parameters", () => {
  it("maps valid 1-based values to a zero-based index", () => {
    expect(parseStepParam("2", 3)).toEqual({ index: 1, valid: true })
  })

  it("heals invalid values to the first step", () => {
    expect(parseStepParam("4", 3)).toEqual({ index: 0, valid: false })
  })

  it("applies a variation only to the step addressed by the deep link", () => {
    expect(variationForStep("empty", 1, 0)).toBeNull()
    expect(variationForStep("empty", 1, 1)).toBe("empty")
    expect(variationForStep("empty", 1, 2)).toBeNull()
  })
})
