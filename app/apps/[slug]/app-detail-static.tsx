import { AppShell } from "@/components/layout/app-shell"
import { AppHeaderLayout } from "@/components/app-detail/app-header-layout"
import { TabBar } from "@/components/app-detail/tab-bar"
import {
  ScreensGridLayout,
  ScreenTile,
  screenTileWrapperClass,
} from "@/components/app-detail/screen-tile"
import { captureUrl } from "@/lib/images"
import { screenHref } from "@/lib/links"
import { cn, formatDate } from "@/lib/utils"
import type { AppCapture, AppIndex } from "@/lib/types"
import Link from "next/link"

// Server-rendered default view (Screens tab) used as the <Suspense> fallback.
// The interactive client subtree reads search params (nuqs → useSearchParams),
// which bails out of static rendering — so the static HTML would otherwise be a
// skeleton. Rendering the real screens here puts actual content (images +
// titles) into the prerendered HTML for crawlers/LLMs and first paint; the
// client takes over on hydration. The chrome and cards come from the same
// presentational pieces the client uses, so the two can't drift — this file
// just supplies the inert, search-param-free variants of their inputs.
export function AppDetailStatic({
  view,
  appIndex,
  appSlug,
}: {
  view: AppCapture
  appIndex: AppIndex
  appSlug: string
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <AppHeaderLayout
          slug={appSlug}
          name={view.app.name}
          screens={view.screens.length}
          flows={view.flows.length}
          dateControl={<span>{formatDate(appIndex.latest)}</span>}
        />

        <TabBar
          items={[
            { label: "Screens", count: view.screens.length, active: true },
            { label: "Flows", count: view.flows.length, active: false },
          ]}
        />
      </div>

      <ScreensGridLayout className="mt-6">
        {view.screens.map((screen) => (
          <Link
            key={screen.id}
            href={screenHref(appSlug, screen.id)}
            className={cn(screenTileWrapperClass, "cursor-zoom-in")}
          >
            <ScreenTile imageBoxStyle={{ aspectRatio: "9/19.5" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={captureUrl(appSlug, screen.screenshotPath)}
                alt={screen.description}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </ScreenTile>
          </Link>
        ))}
      </ScreensGridLayout>
    </AppShell>
  )
}
