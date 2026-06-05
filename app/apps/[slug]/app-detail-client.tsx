"use client"

import { AppShell } from "@/components/layout/app-shell"
import { AppHeader } from "@/components/app-detail/app-header"
import { ScreensGrid } from "@/components/app-detail/screens-grid"
import { FlowsView } from "@/components/app-detail/flows-view"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import { fetchAppCapture } from "@/lib/data"
import type { AppCapture, AppIndex } from "@/lib/types"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useQueryState, parseAsStringLiteral } from "nuqs"

const tabs = ["screens", "flows"] as const

interface AppDetailClientProps {
  slug: string
  /** Latest-capture view, read at build time — the initial (and usually only) data. */
  initialView: AppCapture
  initialAppIndex: AppIndex
}

export function AppDetailClient({
  slug,
  initialView,
  initialAppIndex,
}: AppDetailClientProps) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("screens")
  )
  const [activeFlowSlug, setActiveFlowSlug] = useQueryState("flow")
  const [, setStepParam] = useQueryState("step")
  const [dateParam] = useQueryState("date")
  const [activeScreenId, setActiveScreenId] = useQueryState("screen")

  // The latest capture is seeded from build-time props, so the client renders
  // content immediately on hydration — no fetch, no loading state. Only an
  // older selected date triggers a fetch; until it resolves we keep showing the
  // latest. `app` is derived (no setState-in-effect) to avoid cascading renders.
  const date = dateParam ?? initialAppIndex.latest
  const isLatest = date === initialAppIndex.latest
  const [olderView, setOlderView] = useState<AppCapture | null>(null)
  const app = isLatest ? initialView : olderView ?? initialView

  // The chrome (app header + tabs) is pinned on the Flows tab; measure its
  // height so the fixed sidebar can sit exactly below it. This is a stable
  // measurement (only fires on resize/content change, never on scroll).
  const chromeRef = useRef<HTMLDivElement>(null)
  const [contentTop, setContentTop] = useState(0)
  useEffect(() => {
    const el = chromeRef.current
    if (!el) return
    const NAVBAR_PX = 56 // h-14
    const update = () => setContentTop(NAVBAR_PX + el.offsetHeight)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [app, tab])

  // Fetch only when an older capture is selected.
  useEffect(() => {
    if (isLatest) return
    let cancelled = false
    fetchAppCapture(slug, date).then((capture) => {
      if (!cancelled) setOlderView(capture)
    })
    return () => {
      cancelled = true
    }
  }, [slug, date, isLatest])

  const isFlows = tab === "flows"

  return (
    // The whole page scrolls the window. On Flows the chrome (app header +
    // tabs) is pinned and the sidebar is a fixed rail sitting just below it;
    // Screens scrolls normally with the chrome.
    <AppShell>
      <div
        style={
          { "--content-top": contentTop ? `${contentTop}px` : "13rem" } as React.CSSProperties
        }
      >
        <div
          ref={chromeRef}
          className={cn(
            "space-y-6",
            isFlows &&
              "lg:sticky lg:top-14 lg:z-30 lg:-mx-4 lg:-mt-6 lg:bg-background lg:px-4 lg:pt-6 lg:pb-6"
          )}
        >
          <AppHeader
            app={app}
            appIndex={initialAppIndex}
            currentDate={dateParam ?? initialAppIndex.latest}
          />

          <div className="flex gap-4 border-b">
            <button
              onClick={() => {
                setTab("screens")
                setActiveFlowSlug(null)
                setStepParam(null)
              }}
              className={cn(
                "border-b-2 pb-2 text-sm font-medium transition-colors",
                tab === "screens"
                  ? "border-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Screens ({app.screens.length})
            </button>
            <button
              onClick={() => {
                setTab("flows")
                setActiveScreenId(null)
              }}
              className={cn(
                "border-b-2 pb-2 text-sm font-medium transition-colors",
                tab === "flows"
                  ? "border-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Flows ({app.flows.length})
            </button>
          </div>
        </div>

        {/* Content scrolls with the page. The gap below the chrome is part of
            the pinned chrome on flows (lg:pb-6), so no top margin there. */}
        <div className={cn("mt-6", isFlows && "lg:mt-0")}>
          {tab === "screens" ? (
            <ScreensGrid screens={app.screens} appSlug={slug} />
          ) : (
            <FlowsView
              app={app}
              appSlug={slug}
              activeFlowSlug={activeFlowSlug ?? undefined}
            />
          )}
        </div>
      </div>

      {activeScreenId && app.screens.some((s) => s.id === activeScreenId) && (
        <ScreenLightbox
          screens={app.screens}
          activeScreenId={activeScreenId}
          appSlug={slug}
        />
      )}
    </AppShell>
  )
}
