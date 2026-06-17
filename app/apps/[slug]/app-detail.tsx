import { Suspense } from "react"
import type { CSSProperties } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { AppHeaderLayout } from "@/components/app-detail/app-header-layout"
import { StickyChrome } from "@/components/app-detail/sticky-chrome"
import { TabBar } from "@/components/app-detail/tab-bar"
import { TabState } from "@/components/app-detail/tab-state"
import { DateControl } from "@/components/app-detail/date-control"
import { ScreensGrid } from "@/components/app-detail/screens-grid"
import { FlowsView } from "@/components/app-detail/flows-view"
import { ScreenLightboxIsland } from "@/components/app-detail/screen-lightbox-island"
import type { AppCapture, AppIndex } from "@/lib/types"

// Server-rendered app detail. The chrome and the screens grid render to static
// HTML (no first-paint swap, crawlable); only the param-driven bits are client
// islands behind <Suspense> (so reading ?tab/?flow/?screen never de-opts the
// grid's prerender): TabState reflects ?tab onto the root for CSS visibility,
// FlowsView reads ?flow, the lightbox reads ?screen. Both tab panels render so
// switching tabs is an instant CSS toggle rather than an unmount/remount.
export function AppDetail({
  slug,
  view,
  appIndex,
  date,
}: {
  slug: string
  view: AppCapture
  appIndex: AppIndex
  date: string
}) {
  return (
    <AppShell>
      <div
        id="app-detail-root"
        data-detail-root
        style={{ "--content-top": "13rem" } as CSSProperties}
      >
        <StickyChrome>
          <AppHeaderLayout
            slug={slug}
            name={view.app.name}
            dateControl={
              <DateControl
                slug={slug}
                captures={appIndex.captures}
                currentDate={date}
                latest={appIndex.latest}
              />
            }
          />
          <TabBar
            screensCount={view.screens.length}
            flowsCount={view.flows.length}
          />
        </StickyChrome>

        <Suspense fallback={null}>
          <TabState />
        </Suspense>

        {/* Both panels render; CSS shows the active one (data-active-tab). */}
        <div className="mt-6 lg:mt-0">
          <section data-tab-panel="screens">
            <ScreensGrid screens={view.screens} appSlug={slug} />
          </section>
          {/* FlowsView server-renders the flow list; only its lightbox island
              reads searchParams (Suspense lives inside it). */}
          <section data-tab-panel="flows">
            <FlowsView app={view} appSlug={slug} />
          </section>
        </div>
      </div>

      <Suspense fallback={null}>
        <ScreenLightboxIsland
          screens={view.screens}
          flows={view.flows}
          aliases={view.screenAliases ?? {}}
          appSlug={slug}
        />
      </Suspense>
    </AppShell>
  )
}
