import { describe, expect, it } from "vitest"
import { buildFlowStepConnections } from "@/lib/flow-connections"
import type { ClientFlow, ClientScreen } from "@/lib/types"

const screens = [
  { id: "card", stateGroup: "card", state: "Available" },
  { id: "card-issued", stateGroup: "card", state: "Issued" },
  { id: "add-money" },
] as ClientScreen[]

const flows = [
  {
    id: "card",
    slug: "card",
    name: "Card",
    steps: [{ number: 1, screenId: "card" }],
    entryPoints: [],
  },
  {
    id: "adding-money",
    slug: "adding-money",
    name: "Adding money",
    steps: [{ number: 2, screenId: "add-money" }],
    entryPoints: [
      {
        flowId: "card",
        fromScreenId: "card-issued",
        toScreenId: "add-money",
      },
    ],
  },
] as ClientFlow[]

describe("flow screen connections", () => {
  it("targets the exact destination step from a concrete source variation", () => {
    expect(
      buildFlowStepConnections("card", flows, screens).get("card-issued")
    ).toEqual([
      {
        direction: "to",
        flowId: "adding-money",
        flowName: "Adding money",
        step: 2,
        screenId: "add-money",
      },
    ])
  })

  it("does not expose a variation-specific connection on the rendered default", () => {
    expect(
      buildFlowStepConnections("card", flows, screens).get("card")
    ).toBeUndefined()
  })

  it("links the destination screen back to the matching source step", () => {
    expect(
      buildFlowStepConnections("adding-money", flows, screens).get("add-money")
    ).toEqual([
      {
        direction: "from",
        flowId: "card",
        flowName: "Card",
        step: 1,
        screenId: "card-issued",
      },
    ])
  })
})
