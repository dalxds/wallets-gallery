"use client"

import { useEffect } from "react"
import { useQueryState } from "nuqs"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"
import { followAlias } from "@/lib/links"
import type { StateIndex } from "@/lib/states"
import type { AppCapture } from "@/lib/types"

// Reads ?flow/?step and opens the flow lightbox over the (server-rendered) flow
// list. The single place the flows subtree reads searchParams — isolated here so
// the rows/sidebar stay in the static prerender. Renders nothing when no flow is
// selected; lives behind a <Suspense>.
export function FlowLightboxIsland({
  flows,
  aliases,
  stateIndex,
  appSlug,
}: {
  flows: AppCapture["flows"]
  /** Retired→current slug redirects (view.flowAliases) so stale links still resolve. */
  aliases: AppCapture["flowAliases"]
  stateIndex: StateIndex
  appSlug: string
}) {
  const [flowParam, setFlowParam] = useQueryState("flow")
  const [stepParam, setStepParam] = useQueryState("step")
  // Try the slug as-is, then follow one alias hop for links shared before a slug change.
  const canonical = flowParam ? followAlias(flowParam, aliases) : null
  const flow = canonical ? flows.find((f) => f.slug === canonical) : undefined

  // When we resolved via an alias, rewrite ?flow to the canonical slug so the
  // address bar self-heals (and a re-share carries the live link).
  useEffect(() => {
    if (flow && flowParam && flowParam !== flow.slug) setFlowParam(flow.slug)
  }, [flow, flowParam, setFlowParam])

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
