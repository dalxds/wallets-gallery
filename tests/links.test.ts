import { describe, it, expect } from "vitest"
import {
  appHref,
  dateHref,
  captureHref,
  screenHref,
  flowHref,
} from "@/lib/links"

describe("navigation hrefs", () => {
  it("appHref points at the clean evergreen route", () => {
    expect(appHref("tuyo")).toBe("/apps/tuyo")
  })

  it("dateHref collapses the latest to the clean route", () => {
    expect(dateHref("tuyo", "2026-06-05", "2026-06-05")).toBe("/apps/tuyo")
  })

  it("dateHref keeps the date segment for non-latest captures", () => {
    expect(dateHref("tuyo", "2026-01-01", "2026-06-05")).toBe(
      "/apps/tuyo/2026-01-01"
    )
  })
})

describe("permalink hrefs", () => {
  it("captureHref always pins the date segment", () => {
    expect(captureHref("tuyo", "2026-06-05")).toBe("/apps/tuyo/2026-06-05")
  })

  it("screenHref pins the date even when it is the latest capture", () => {
    // The whole point: a copied link never drifts off the capture on screen.
    expect(screenHref("tuyo", "2026-06-05", "home")).toBe(
      "/apps/tuyo/2026-06-05?tab=screens&screen=home"
    )
  })

  it("flowHref pins the date and carries an optional step", () => {
    expect(flowHref("tuyo", "2026-06-05", "send-crypto")).toBe(
      "/apps/tuyo/2026-06-05?tab=flows&flow=send-crypto"
    )
    expect(flowHref("tuyo", "2026-06-05", "send-crypto", 2)).toBe(
      "/apps/tuyo/2026-06-05?tab=flows&flow=send-crypto&step=2"
    )
  })

  it("encodes ids and slugs in the query", () => {
    expect(screenHref("tuyo", "2026-06-05", "a/b c")).toBe(
      "/apps/tuyo/2026-06-05?tab=screens&screen=a%2Fb%20c"
    )
    expect(flowHref("tuyo", "2026-06-05", "a/b")).toBe(
      "/apps/tuyo/2026-06-05?tab=flows&flow=a%2Fb"
    )
  })
})
