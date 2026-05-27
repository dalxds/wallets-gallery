"use client"

import type { AppCapture } from "@/lib/types"
import { FlowSidebar } from "./flow-sidebar"
import { FlowRow } from "./flow-row"
import { useCallback, useEffect, useRef, useState } from "react"

interface FlowsViewProps {
  app: AppCapture
  appSlug: string
  activeFlowSlug?: string
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

  // Scroll to active flow on initial load
  useEffect(() => {
    if (!activeFlowSlug) return
    requestAnimationFrame(() => {
      const el = flowRefs.current.get(activeFlowSlug)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }, [activeFlowSlug])

  const topLevel = app.flows.filter((f) => !f.parent)

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
        {/* Mobile sidebar */}
        <div className="mb-4 lg:hidden">
          <FlowSidebar
            flows={app.flows}
            activeFlowSlug={currentSlug}
            onFlowClick={scrollToFlow}
          />
        </div>
        <div className="space-y-8">
          {topLevel.map((flow) => {
            const children = app.flows.filter(
              (f) => f.parent === flow.slug
            )

            return (
              <div key={flow.slug}>
                <div
                  ref={(el) => {
                    if (el) flowRefs.current.set(flow.slug, el)
                  }}
                  className="scroll-mt-20"
                >
                  <FlowRow
                    flow={flow}
                    appSlug={appSlug}
                  />
                </div>
                {children.map((child) => (
                  <div
                    key={child.slug}
                    ref={(el) => {
                      if (el)
                        flowRefs.current.set(child.slug, el)
                    }}
                    className="ml-6 mt-4 scroll-mt-20 border-l pl-6"
                  >
                    <FlowRow
                      flow={child}
                      appSlug={appSlug}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
