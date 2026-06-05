"use client"

import { AppCard } from "@/components/browse/app-card"
import {
  SortControls,
  type SortMode,
  type ViewMode,
} from "@/components/browse/sort-controls"
import { AppShell } from "@/components/layout/app-shell"
import type { AppIndex } from "@/lib/types"
import { useMemo, useState } from "react"

// Apps arrive as props from the server (build-time read of index.json), so the
// content prerenders into the static HTML and there are no client fetches —
// this component only layers on sort/view interactivity.
export function BrowseClient({ apps }: { apps: AppIndex[] }) {
  const [sort, setSort] = useState<SortMode>("latest")
  const [view, setView] = useState<ViewMode>("list")

  const sorted = useMemo(() => {
    const list = [...apps]
    if (sort === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      list.sort((a, b) => b.latest.localeCompare(a.latest))
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
              Browse captured UI flows from crypto wallets and fintech apps
            </p>
          </div>
          <SortControls
            sort={sort}
            onSortChange={setSort}
            view={view}
            onViewChange={setView}
          />
        </div>
        {view === "list" ? (
          <div className="flex flex-col gap-3">
            {sorted.map((app) => (
              <AppCard key={app.slug} app={app} view="list" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((app) => (
              <AppCard key={app.slug} app={app} view="grid" />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
