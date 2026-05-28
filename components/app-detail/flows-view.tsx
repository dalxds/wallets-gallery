"use client"

import type { AppCapture, FlowEntry } from "@/lib/types"
import { FlowSidebar } from "./flow-sidebar"
import { FlowRow } from "./flow-row"
import { useCallback, useEffect, useRef, useState } from "react"

interface FlowsViewProps {
  app: AppCapture
  appSlug: string
  activeFlowSlug?: string
}

function FlowTree({
  flow,
  allFlows,
  depth,
  appSlug,
  flowRefs,
}: {
  flow: FlowEntry
  allFlows: FlowEntry[]
  depth: number
  appSlug: string
  flowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
}) {
  const children = allFlows.filter((f) => f.parent === flow.slug)

  return (
    <div>
      <div
        ref={(el) => {
          if (el) flowRefs.current.set(flow.slug, el)
        }}
        className="scroll-mt-20"
      >
        <FlowRow flow={flow} appSlug={appSlug} />
      </div>
      {children.length > 0 && (
        <div className="ml-6 mt-4 space-y-6 border-l pl-6">
          {children.map((child) => (
            <FlowTree
              key={child.slug}
              flow={child}
              allFlows={allFlows}
              depth={depth + 1}
              appSlug={appSlug}
              flowRefs={flowRefs}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FlowsView({
  app,
  appSlug,
  activeFlowSlug,
}: FlowsViewProps) {
  const [currentSlug, setCurrentSlug] = useState(activeFlowSlug)
  const flowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const scrollToFlow = useCallback((slug: string) => {
    setCurrentSlug(slug)
    requestAnimationFrame(() => {
      const el = flowRefs.current.get(slug)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }, [])

  useEffect(() => {
    if (!activeFlowSlug) return
    requestAnimationFrame(() => {
      const el = flowRefs.current.get(activeFlowSlug)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }, [activeFlowSlug])

  const topLevel = app.flows.filter((f) => f.parent === null)

  return (
    <div className="flex gap-6">
      <div className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-20">
          <FlowSidebar
            flows={app.flows}
            activeFlowSlug={currentSlug}
            onFlowClick={scrollToFlow}
          />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-4 lg:hidden">
          <FlowSidebar
            flows={app.flows}
            activeFlowSlug={currentSlug}
            onFlowClick={scrollToFlow}
          />
        </div>
        <div className="space-y-8">
          {topLevel.map((flow) => (
            <FlowTree
              key={flow.slug}
              flow={flow}
              allFlows={app.flows}
              depth={0}
              appSlug={appSlug}
              flowRefs={flowRefs}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
