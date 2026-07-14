"use client"

import { useCallback, useMemo, useState } from "react"
import type { ClientFlow, ClientScreen } from "@/lib/types"
import { flowHref } from "@/lib/links"
import { stateMeta } from "@/lib/states"
import { FlowViewer } from "./flow-viewer"

interface FlowNavigatorProps {
  initialFlow: ClientFlow
  flows: ClientFlow[]
  screens: ClientScreen[]
  appSlug: string
  appName: string
  appLogo: string | null
  backHref: string
  date: string
  onClose?: () => void
}

// Keeps cross-flow screen navigation inside one viewer. The URL follows the active
// flow/step without a Next router transition, so an intercepted Dialog is replaced
// in place instead of stacking another lightbox over it.
export function FlowNavigator({
  initialFlow,
  flows,
  screens,
  appSlug,
  appName,
  appLogo,
  backHref,
  date,
  onClose,
}: FlowNavigatorProps) {
  const flowById = useMemo(
    () => new Map(flows.map((flow) => [flow.id, flow])),
    [flows]
  )
  const screenById = useMemo(
    () => new Map(screens.map((screen) => [screen.id, screen])),
    [screens]
  )
  const [activeFlowId, setActiveFlowId] = useState(initialFlow.id)
  const activeFlow = flowById.get(activeFlowId) ?? initialFlow

  const navigateFlow = useCallback(
    (flowId: string, step: number, screenId: string) => {
      if (!flowById.has(flowId)) return
      const state = screenById.get(screenId)?.state
      const variation = state ? stateMeta(state).label : undefined
      window.history.replaceState(
        window.history.state,
        "",
        flowHref(appSlug, flowId, date, step, variation)
      )
      setActiveFlowId(flowId)
    },
    [appSlug, date, flowById, screenById]
  )

  return (
    <FlowViewer
      key={activeFlow.id}
      flow={activeFlow}
      flows={flows}
      screens={screens}
      appSlug={appSlug}
      appName={appName}
      appLogo={appLogo}
      backHref={backHref}
      date={date}
      onNavigateFlow={navigateFlow}
      onClose={onClose}
    />
  )
}
