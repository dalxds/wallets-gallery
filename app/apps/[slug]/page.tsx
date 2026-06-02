"use client"

import { AppShell } from "@/components/layout/app-shell"
import { AppHeader } from "@/components/app-detail/app-header"
import { ScreensGrid } from "@/components/app-detail/screens-grid"
import { FlowsView } from "@/components/app-detail/flows-view"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import { getAppsIndex, fetchAppCapture } from "@/lib/data"
import type { AppCapture, AppIndex } from "@/lib/types"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useQueryState, parseAsStringLiteral } from "nuqs"

const tabs = ["screens", "flows"] as const

export default function AppDetailPage() {
  const params = useParams<{ slug: string }>()
  const [app, setApp] = useState<AppCapture | null>(null)
  const [appIndex, setAppIndex] = useState<AppIndex | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("screens")
  )
  const [activeFlowSlug, setActiveFlowSlug] = useQueryState("flow")
  const [, setStepParam] = useQueryState("step")
  const [dateParam, setDateParam] = useQueryState("date")
  const [activeScreenId, setActiveScreenId] = useQueryState("screen")

  const slug = params.slug

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

  useEffect(() => {
    async function load() {
      const registry = await getAppsIndex()
      const idx = registry.apps.find((a) => a.slug === slug)
      if (!idx) return
      setAppIndex(idx)

      const date = dateParam ?? idx.latest
      const capture = await fetchAppCapture(slug, date)
      setApp(capture)
      setLoading(false)
    }
    load()
  }, [slug, dateParam])

  if (loading) {
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

  if (!app || !appIndex) {
    return (
      <AppShell>
        <p>App not found.</p>
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
          <AppHeader app={app} appIndex={appIndex} currentDate={dateParam ?? appIndex.latest} />

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
