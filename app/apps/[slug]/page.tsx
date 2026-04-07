"use client"

import { AppShell } from "@/components/layout/app-shell"
import { AppHeader } from "@/components/app-detail/app-header"
import { ScreensGrid } from "@/components/app-detail/screens-grid"
import { FlowsView } from "@/components/app-detail/flows-view"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import { getAppsIndex, fetchAppCapture } from "@/lib/data"
import type { AppCapture, AppIndex } from "@/lib/types"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
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

  const date = dateParam ?? appIndex?.latest ?? ""

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

  return (
    <AppShell>
      <div className="space-y-6">
        <AppHeader app={app} appIndex={appIndex} currentDate={date} />

        {/* Client-side tabs — no navigation, no flicker */}
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

        {tab === "screens" ? (
          <ScreensGrid
            screens={app.screens}
            appSlug={slug}
            date={date}
          />
        ) : (
          <FlowsView
            app={app}
            appSlug={slug}
            date={date}
            activeFlowSlug={activeFlowSlug ?? undefined}
          />
        )}
      </div>

      {activeScreenId && app.screens.some((s) => s.id === activeScreenId) && (
        <ScreenLightbox
          screens={app.screens}
          activeScreenId={activeScreenId}
          appSlug={slug}
          date={date}
        />
      )}
    </AppShell>
  )
}
