"use client"

import { AppShell } from "@/components/layout/app-shell"
import { AppHeader } from "@/components/app-detail/app-header"
import { ScreensGrid } from "@/components/app-detail/screens-grid"
import { TabBar } from "@/components/app-detail/tab-bar"
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

  // One view per capture date, seeded with the latest (read at build time, so it
  // renders instantly on hydration — no fetch). Older dates are fetched on demand
  // and cached here. The latest is just a pre-populated key, so there's no special
  // "is this the latest?" branch to keep in sync: `app` is simply the view for the
  // selected date, and `undefined` (an older date still loading) drives the skeleton.
  const date = dateParam ?? initialAppIndex.latest
  const [viewByDate, setViewByDate] = useState<Record<string, AppCapture>>({
    [initialAppIndex.latest]: initialView,
  })
  const app: AppCapture | undefined = viewByDate[date]

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

  // Fetch the selected date's view if we don't already have it (the latest is
  // pre-seeded, so this only fires for older dates, once each — the result is
  // cached). On failure it stays absent, leaving the skeleton up rather than a
  // dangling rejection or stale data; the date selector still works.
  useEffect(() => {
    if (viewByDate[date]) return
    let cancelled = false
    fetchAppCapture(slug, date)
      .then((view) => {
        if (!cancelled) setViewByDate((m) => ({ ...m, [date]: view }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [slug, date, viewByDate])

  // An older date is still loading (or failed). Show a skeleton rather than
  // flashing the latest capture's content under the selected (older) date.
  if (!app) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
            <div className="space-y-2">
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg bg-muted"
                style={{ aspectRatio: "9/19.5" }}
              />
            ))}
          </div>
        </div>
      </AppShell>
    )
  }

  const isFlows = tab === "flows"

  return (
    // The whole page scrolls the window. On Flows the chrome (app header +
    // tabs) is pinned and the sidebar is a fixed rail sitting just below it;
    // Screens scrolls normally with the chrome.
    <AppShell>
      <div
        style={
          {
            "--content-top": contentTop ? `${contentTop}px` : "13rem",
          } as React.CSSProperties
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

          <TabBar
            items={[
              {
                label: "Screens",
                count: app.screens.length,
                active: tab === "screens",
                onSelect: () => {
                  setTab("screens")
                  setActiveFlowSlug(null)
                  setStepParam(null)
                },
              },
              {
                label: "Flows",
                count: app.flows.length,
                active: tab === "flows",
                onSelect: () => {
                  setTab("flows")
                  setActiveScreenId(null)
                },
              },
            ]}
          />
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
          flows={app.flows}
          activeScreenId={activeScreenId}
          appSlug={slug}
          platform={app.app.platform}
        />
      )}
    </AppShell>
  )
}
