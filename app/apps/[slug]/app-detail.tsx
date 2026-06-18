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
import type { AppCapture, AppIndex } from "@/lib/types"

// Server-rendered app detail. The chrome and the screens grid render to static
// HTML (crawlable, no first-paint swap); only ?tab (TabState, reflected onto the
// root for CSS panel visibility) is a client island behind <Suspense>. Screen and
// flow lightboxes are no longer islands here — they're intercepting-route modals
// served by the @modal parallel slot in the layout (a tile click navigates to the
// screen/flow route, which is intercepted into a modal over this gallery). Both
// tab panels render so switching tabs is an instant CSS toggle.
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
            <ScreensGrid
              screens={view.screens}
              appSlug={slug}
              date={date}
              latest={appIndex.latest}
            />
          </section>
          {/* FlowsView server-renders the flow list; each step links to a flow
              route that the @modal slot intercepts into the lightbox. */}
          <section data-tab-panel="flows">
            <FlowsView
              app={view}
              appSlug={slug}
              date={date}
              latest={appIndex.latest}
            />
          </section>
        </div>
      </div>
    </AppShell>
  )
}
