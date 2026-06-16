"use client"

import { useEffect } from "react"
import { useQueryState } from "nuqs"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"
import type { StateIndex } from "@/lib/states"
import type { AppCapture } from "@/lib/types"

// Reads ?flow/?step and opens the flow lightbox over the (server-rendered) flow
// list. The single place the flows subtree reads searchParams — isolated here so
// the rows/sidebar stay in the static prerender. Renders nothing when no flow is
// selected; lives behind a <Suspense>.
export function FlowLightboxIsland({
  flows,
  stateIndex,
  appSlug,
}: {
  flows: AppCapture["flows"]
  stateIndex: StateIndex
  appSlug: string
}) {
  const [flowParam, setFlowParam] = useQueryState("flow")
  const [stepParam, setStepParam] = useQueryState("step")
  const flow = flowParam ? flows.find((f) => f.slug === flowParam) : undefined

  // Scroll the underlying row into view when a flow opens, so closing the
  // lightbox lands on that row (covers deep links and search navigation).
  useEffect(() => {
    if (flow) {
      document
        .getElementById(`flow-${flow.slug}`)
        ?.scrollIntoView({ block: "start" })
    }
  }, [flow])

  if (!flow) return null
  const parsed = stepParam ? parseInt(stepParam, 10) : 0
  return (
    <FlowLightbox
      flow={flow}
      appSlug={appSlug}
      initialIndex={Number.isNaN(parsed) ? 0 : parsed}
      stateIndex={stateIndex}
      onClose={() => {
        setFlowParam(null)
        setStepParam(null)
      }}
    />
  )
}
