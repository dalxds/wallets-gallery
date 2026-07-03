import { Suspense, type CSSProperties } from "react"
import { readRegistry } from "@/lib/captures"
import { AppShell } from "@/components/layout/app-shell"
import { AppCard } from "@/components/browse/app-card"
import { BrowseControls } from "@/components/browse/browse-controls"

// Read the registry at build time and prerender the gallery into static HTML.
// The cards render server-side (crawlable, no client fetch); the sort order is
// URL state applied by CSS off a data attribute the BrowseControls island sets,
// so the index stays static while the control stays shareable. Each card carries
// its precomputed rank for both sort orders.
export default function BrowsePage() {
  // The one canonical registry read (cached, shared with the app/OG routes).
  const apps = readRegistry().apps

  // Live gallery totals, summed from the registry the page already loaded (each
  // app's `screens`/`flows` are its latest capture's counts — see build-data.ts).
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`
  const stats = [
    count(apps.length, "app"),
    count(
      apps.reduce((n, a) => n + a.screens, 0),
      "screen"
    ),
    count(
      apps.reduce((n, a) => n + a.flows, 0),
      "flow"
    ),
  ].join(" · ")

  const latestRank = new Map(
    [...apps]
      .sort((a, b) => b.latest.localeCompare(a.latest))
      .map((a, i) => [a.slug, i])
  )
  const alphaRank = new Map(
    [...apps]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a, i) => [a.slug, i])
  )

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Apps</h1>
            <p className="text-muted-foreground">{stats}</p>
          </div>
          <Suspense fallback={null}>
            <BrowseControls />
          </Suspense>
        </div>

        <div id="browse-grid" className="browse-grid">
          {apps.map((app) => (
            <div
              key={app.slug}
              className="browse-card"
              style={
                {
                  "--rank-latest": String(latestRank.get(app.slug) ?? 0),
                  "--rank-alpha": String(alphaRank.get(app.slug) ?? 0),
                } as CSSProperties
              }
            >
              <AppCard app={app} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
