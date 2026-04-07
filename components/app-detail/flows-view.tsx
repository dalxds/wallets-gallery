"use client"

import type { AppCapture, FlowDetail } from "@/lib/types"
import { FlowSidebar } from "./flow-sidebar"
import { FlowRow } from "./flow-row"
import { fetchFlow } from "@/lib/data"
import { useCallback, useEffect, useRef, useState } from "react"

interface FlowsViewProps {
  app: AppCapture
  appSlug: string
  date: string
  activeFlowSlug?: string
}

export function FlowsView({
  app,
  appSlug,
  date,
  activeFlowSlug,
}: FlowsViewProps) {
  const [flowDetails, setFlowDetails] = useState<
    Map<string, FlowDetail>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [currentSlug, setCurrentSlug] = useState(activeFlowSlug)
  const flowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    async function loadFlows() {
      const details = new Map<string, FlowDetail>()
      await Promise.all(
        app.flows.map(async (flow) => {
          try {
            const detail = await fetchFlow(appSlug, date, flow.path)
            details.set(flow.slug, detail)
          } catch {
            // skip
          }
        })
      )
      setFlowDetails(details)
      setLoading(false)
    }
    loadFlows()
  }, [app.flows, appSlug, date])

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
    if (!activeFlowSlug || loading) return
    requestAnimationFrame(() => {
      const el = flowRefs.current.get(activeFlowSlug)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }, [activeFlowSlug, loading])

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
        {loading ? (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-96 animate-pulse rounded bg-muted" />
                <div className="flex gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="h-64 w-32 animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {topLevel.map((flow) => {
              const detail = flowDetails.get(flow.slug)
              const children = app.flows.filter(
                (f) => f.parent === flow.slug
              )
              const flowDir = flow.path.replace("/flow.json", "")

              return (
                <div key={flow.slug}>
                  <div
                    ref={(el) => {
                      if (el) flowRefs.current.set(flow.slug, el)
                    }}
                    className="scroll-mt-20"
                  >
                    {detail && (
                      <FlowRow
                        flow={detail}
                        appSlug={appSlug}
                        date={date}
                        flowDir={flowDir}
                      />
                    )}
                  </div>
                  {children.map((child) => {
                    const childDetail = flowDetails.get(child.slug)
                    const childFlowDir = child.path.replace(
                      "/flow.json",
                      ""
                    )
                    return (
                      <div
                        key={child.slug}
                        ref={(el) => {
                          if (el)
                            flowRefs.current.set(child.slug, el)
                        }}
                        className="ml-6 mt-4 scroll-mt-20 border-l pl-6"
                      >
                        {childDetail && (
                          <FlowRow
                            flow={childDetail}
                            appSlug={appSlug}
                            date={date}
                            flowDir={childFlowDir}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
