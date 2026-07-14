import type { ClientFlow, ClientScreen } from "./types"

export interface FlowStepConnection {
  direction: "from" | "to"
  flowId: string
  flowName: string
  step: number
  screenId: string
}

// Index authored entry relationships for one active flow. Group identity finds
// the rendered step, but capability visibility stays on the exact concrete
// source/destination variation named by the entry.
export function buildFlowStepConnections(
  activeFlowId: string,
  flows: ClientFlow[],
  screens: ClientScreen[]
): Map<string, FlowStepConnection[]> {
  const result = new Map<string, FlowStepConnection[]>()
  const flowById = new Map(flows.map((flow) => [flow.id, flow]))
  const screenById = new Map(screens.map((screen) => [screen.id, screen]))
  const groupOf = (screenId: string) =>
    screenById.get(screenId)?.stateGroup ?? screenId
  const stepFor = (flow: ClientFlow, screenId: string) => {
    const group = groupOf(screenId)
    return flow.steps.find((step) => groupOf(step.screenId) === group)
  }
  const add = (screenId: string, connection: FlowStepConnection) => {
    const connections = result.get(screenId) ?? []
    if (
      !connections.some(
        (item) =>
          item.direction === connection.direction &&
          item.flowId === connection.flowId &&
          item.step === connection.step &&
          item.screenId === connection.screenId
      )
    )
      connections.push(connection)
    result.set(screenId, connections)
  }

  for (const destination of flows) {
    for (const entry of destination.entryPoints) {
      const source = flowById.get(entry.flowId)
      if (!source) continue
      const sourceStep = stepFor(source, entry.fromScreenId)
      const destinationStep = stepFor(destination, entry.toScreenId)
      if (!sourceStep || !destinationStep) continue
      if (activeFlowId === source.id)
        add(entry.fromScreenId, {
          direction: "to",
          flowId: destination.id,
          flowName: destination.name,
          step: destinationStep.number,
          screenId: entry.toScreenId,
        })
      if (activeFlowId === destination.id)
        add(entry.toScreenId, {
          direction: "from",
          flowId: source.id,
          flowName: source.name,
          step: sourceStep.number,
          screenId: entry.fromScreenId,
        })
    }
  }
  for (const connections of result.values())
    connections.sort(
      (a, b) =>
        (a.direction < b.direction ? -1 : a.direction > b.direction ? 1 : 0) ||
        (a.flowName < b.flowName ? -1 : a.flowName > b.flowName ? 1 : 0) ||
        (a.flowId < b.flowId ? -1 : a.flowId > b.flowId ? 1 : 0)
    )
  return result
}
