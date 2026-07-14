import { describe, expect, it } from "vitest"
import { buildStateIndex } from "@/lib/states"
import type { ClientScreen } from "@/lib/types"

describe("screen variation ordering", () => {
  it("uses deterministic codepoint ordering for custom labels and ids", () => {
    const screens = [
      { id: "citi", stateGroup: "bank", state: "Citi" },
      { id: "chase", stateGroup: "bank", state: "Chase" },
    ] as ClientScreen[]

    expect(
      buildStateIndex(screens)
        .variantsForScreen("citi")
        .map((screen) => screen.id)
    ).toEqual(["chase", "citi"])
  })

  it("keeps all authored-step variants but hides a context with one eligible variant", () => {
    const screens = [
      { id: "login", stateGroup: "login", state: "Email" },
      { id: "login-phone", stateGroup: "login", state: "Phone" },
    ] as ClientScreen[]
    const index = buildStateIndex(screens)

    expect(index.variantsForScreen("login").map((screen) => screen.id)).toEqual(
      ["login", "login-phone"]
    )
    expect(index.variantsForScreen("login", ["login"])).toEqual([])
  })
})
