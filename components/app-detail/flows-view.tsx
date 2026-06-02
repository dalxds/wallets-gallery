"use client"

import type { AppCapture, FlowEntry } from "@/lib/types"
import { FlowSidebar } from "./flow-sidebar"
import { FlowRow } from "./flow-row"
import { PanelLeftOpen } from "lucide-react"
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
        className="scroll-mt-16 lg:scroll-mt-[var(--content-top)]"
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  // Sidebar/rail are pinned just below the chrome (--content-top, set by the
  // page) and span the rest of the viewport, scrolling internally. The page
  // itself scrolls the window. Sizing is inline so the CSS var resolves
  // cleanly; lg:sticky only engages the positioning on desktop (it's hidden
  // below lg, where the inline mobile sidebar is shown instead).
  const railStyle: React.CSSProperties = {
    top: "var(--content-top)",
    height: "calc(100dvh - var(--content-top) - 1.5rem)",
  }

  return (
    <div className="flex gap-6">
      {/* Desktop: fixed full-height sidebar, or a slim rail when collapsed */}
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          aria-label="Expand flow list"
          title="Expand flow list"
          style={railStyle}
          className="hidden w-9 shrink-0 flex-col items-center gap-3 rounded-lg border bg-muted/30 py-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:sticky lg:flex"
        >
          <PanelLeftOpen className="h-4 w-4" />
          <span className="text-xs font-medium tracking-wide [writing-mode:vertical-rl]">
            Flows
          </span>
        </button>
      ) : (
        <div
          style={railStyle}
          className="hidden w-64 shrink-0 lg:sticky lg:block"
        >
          <FlowSidebar
            flows={app.flows}
            activeFlowSlug={currentSlug}
            onFlowClick={scrollToFlow}
            onCollapse={() => setSidebarCollapsed(true)}
            className="h-full"
          />
        </div>
      )}

      {/* Content column — scrolls with the page */}
      <div className="min-w-0 flex-1">
        {/* Mobile sidebar (shown inline above the flows) */}
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
