"use client"

import { AppCard } from "@/components/browse/app-card"
import {
  SortControls,
  type SortMode,
  type ViewMode,
} from "@/components/browse/sort-controls"
import { AppShell } from "@/components/layout/app-shell"
import { getAppsIndex, fetchAppCapture } from "@/lib/data"
import type { AppIndex, AppCapture } from "@/lib/types"
import { useEffect, useMemo, useState } from "react"

export default function BrowsePage() {
  const [apps, setApps] = useState<AppIndex[]>([])
  const [captures, setCaptures] = useState<Map<string, AppCapture>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>("latest")
  const [view, setView] = useState<ViewMode>("list")

  useEffect(() => {
    async function load() {
      const registry = await getAppsIndex()
      setApps(registry.apps)

      const caps = new Map<string, AppCapture>()
      await Promise.all(
        registry.apps.map(async (app) => {
          try {
            const capture = await fetchAppCapture(app.slug, app.latest)
            caps.set(app.slug, capture)
          } catch {
            // skip
          }
        })
      )
      setCaptures(caps)
      setLoading(false)
    }
    load()
  }, [])

  const sorted = useMemo(() => {
    const list = [...apps]
    if (sort === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      list.sort(
        (a, b) =>
          new Date(b.latest).getTime() - new Date(a.latest).getTime()
      )
    }
    return list
  }, [apps, sort])

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Apps</h1>
            <p className="text-muted-foreground">
              Browse captured UI flows from crypto wallets and fintech
              apps
            </p>
          </div>
          <SortControls
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
          />
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-muted"
              />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-3">
            {sorted.map((app) => (
              <AppCard
                key={app.slug}
                app={app}
                capture={captures.get(app.slug)}
                view="list"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((app) => (
              <AppCard
                key={app.slug}
                app={app}
                capture={captures.get(app.slug)}
                view="grid"
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
