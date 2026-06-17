"use client"

import { useEffect } from "react"
import { useQueryState } from "nuqs"
import { toast } from "sonner"
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
  date,
}: {
  flows: AppCapture["flows"]
  stateIndex: StateIndex
  appSlug: string
  date: string
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

  // A deep link whose flow isn't in this capture (e.g. a permalink to a flow
  // that a later capture dropped/renamed): tell the user instead of silently
  // doing nothing, and drop the dangling params so the URL reflects reality.
  useEffect(() => {
    if (flowParam && !flow) {
      toast("That flow isn't in this capture", {
        id: `missing-flow-${flowParam}`,
        description: "It may have changed in a newer capture.",
      })
      setFlowParam(null)
      setStepParam(null)
    }
  }, [flowParam, flow, setFlowParam, setStepParam])

  if (!flow) return null
  const parsed = stepParam ? parseInt(stepParam, 10) : 0
  return (
    <FlowLightbox
      flow={flow}
      appSlug={appSlug}
      date={date}
      initialIndex={Number.isNaN(parsed) ? 0 : parsed}
      stateIndex={stateIndex}
      onClose={() => {
        setFlowParam(null)
        setStepParam(null)
      }}
    />
  )
}
