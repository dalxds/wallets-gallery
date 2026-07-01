import type { CSSProperties, ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { AppHeaderLayout } from "./app-header-layout"
import { StickyChrome } from "./sticky-chrome"
import { TabBar } from "./tab-bar"
import { DateControl } from "./date-control"
import { captureBase } from "@/lib/links"
import type { CaptureContext } from "@/lib/captures"

// The gallery chrome (app header, date picker, Screens/Flows tabs) for a capture
// — every capture is canonical at its dated URL. Rendered by the (gallery)
// route-group layout, so it PERSISTS across the Screens↔Flows tab switch — that
// switch is a soft navigation between two prerendered routes, and only the panel
// passed as {children} swaps beneath this frame. The header, tabs, and
// StickyChrome's height measurement stay mounted (no remount, no flicker, no
// re-measure).
//
// data-detail-root is the hook StickyChrome uses to publish --content-top (the
// height of the pinned chrome), which the Flows rail sits below; the panels read
// it via inheritance. The frame reads no searchParams, so the panels beneath stay
// in the static prerender.
export function GalleryFrame({
  cap,
  children,
}: {
  cap: CaptureContext
  children: ReactNode
}) {
  const { app, view, date } = cap
  const base = captureBase(app.slug, date)
  return (
    <AppShell>
      <div
        data-detail-root
        style={{ "--content-top": "13rem" } as CSSProperties}
      >
        <StickyChrome>
          <AppHeaderLayout
            slug={app.slug}
            name={view.app.name}
            dateControl={
              <DateControl
                slug={app.slug}
                captures={app.captures}
                currentDate={date}
              />
            }
          />
          <TabBar
            base={base}
            screensCount={view.screens.length}
            flowsCount={view.flows.length}
          />
        </StickyChrome>

        <div className="mt-6">{children}</div>
      </div>
    </AppShell>
  )
}
