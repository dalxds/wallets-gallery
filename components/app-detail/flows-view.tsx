"use client"

import type { AppCapture, FlowEntry } from "@/lib/types"
import { buildStateIndex } from "@/lib/states"
import { FlowSidebar } from "./flow-sidebar"
import { FlowRow } from "./flow-row"
import { PanelLeftOpen } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"

interface FlowsViewProps {
  app: AppCapture
  appSlug: string
  date: string
  latest: string
}

// Flatten the flow tree into a single ordered list (parent, then its children,
// depth-first), preserving each parent group's original order. The hierarchy is
// no longer drawn with indentation — a nested flow surfaces its parent inline in
// its title ("… from {parent}") instead.
function flattenFlows(flows: FlowEntry[]): FlowEntry[] {
  const byParent = new Map<string | null, FlowEntry[]>()
  for (const f of flows) {
    const list = byParent.get(f.parent) ?? []
    list.push(f)
    byParent.set(f.parent, list)
  }
  const out: FlowEntry[] = []
  const visit = (parent: string | null) => {
    for (const f of byParent.get(parent) ?? []) {
      out.push(f)
      visit(f.slug)
    }
  }
  visit(null)
  return out
}

export function FlowsView({ app, appSlug, date, latest }: FlowsViewProps) {
  // Which flow the sidebar highlights — set when the user clicks one. This is
  // just the list highlight; opening a flow is a navigation to its route, which
  // the @modal slot intercepts into the lightbox. No searchParams are read here,
  // so the flow list server-renders into the static HTML.
  const [currentSlug, setCurrentSlug] = useState<string | undefined>(undefined)
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

  const orderedFlows = useMemo(() => flattenFlows(app.flows), [app.flows])
  const flowBySlug = useMemo(
    () => new Map(app.flows.map((f) => [f.slug, f])),
    [app.flows]
  )
  const stateIndex = useMemo(() => buildStateIndex(app.screens), [app.screens])

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
          {orderedFlows.map((flow) => {
            const parentFlow = flow.parent
              ? flowBySlug.get(flow.parent)
              : undefined
            return (
              <div
                key={flow.slug}
                id={`flow-${flow.slug}`}
                ref={(el) => {
                  if (el) flowRefs.current.set(flow.slug, el)
                }}
                className="scroll-mt-16 lg:scroll-mt-[var(--content-top)]"
              >
                <FlowRow
                  flow={flow}
                  appSlug={appSlug}
                  date={date}
                  latest={latest}
                  stateIndex={stateIndex}
                  parent={
                    parentFlow
                      ? { slug: parentFlow.slug, name: parentFlow.name }
                      : undefined
                  }
                  onNavigate={scrollToFlow}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
