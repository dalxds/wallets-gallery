import { describe, it, expect } from "vitest"
import { cn, formatDate } from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates tailwind classes (last wins)", () => {
    expect(cn("p-4", "p-2")).toBe("p-2")
  })

  it("handles undefined and null inputs", () => {
    expect(cn("base", undefined, null)).toBe("base")
  })

  it("handles empty input", () => {
    expect(cn()).toBe("")
  })

  it("merges conflicting tailwind utilities", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("keeps non-conflicting tailwind utilities", () => {
    expect(cn("p-4", "m-2")).toBe("p-4 m-2")
  })

  it("handles object syntax via clsx", () => {
    expect(cn({ hidden: true, visible: false })).toBe("hidden")
  })
})

describe("formatDate", () => {
  it("formats ISO date string to natural format", () => {
    expect(formatDate("2026-04-01")).toBe("Apr 1, 2026")
  })

  it("formats January date", () => {
    expect(formatDate("2025-01-15")).toBe("Jan 15, 2025")
  })

  it("formats December date", () => {
    expect(formatDate("2025-12-25")).toBe("Dec 25, 2025")
  })

  it("handles single-digit day", () => {
    expect(formatDate("2026-03-05")).toBe("Mar 5, 2026")
  })
})
