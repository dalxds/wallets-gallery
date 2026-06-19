import { SiteHeader } from "@/components/layout/site-header"
import { ScreenViewer } from "@/components/lightbox/screen-viewer"
import { captureBase } from "@/lib/links"
import type { AppCapture, ScreenEntry } from "@/lib/types"

// The full-screen page form of the screen viewer — what a shared/refreshed
// /screen/[id] link renders. Same <ScreenViewer> as the modal (header, stage, and
// footer all live in the viewer); the only difference is this chrome: the site
// navbar on top, and no close button. The viewer's header logo/name links back to
// the capture's gallery (its date). Server component (crawlable, with its own OG
// card); the viewer is the client island inside it.
export function ScreenPage({
  view,
  screen,
  appSlug,
  date,
  latest,
  pinnedDate = false,
}: {
  view: AppCapture
  screen: ScreenEntry
  appSlug: string
  date: string
  latest: string
  /** Reached via a date-pinned link (dated route) → keep paging on dated URLs. */
  pinnedDate?: boolean
}) {
  return (
    <>
      <SiteHeader />
      {/* bg-popover so the header/footer/stage surface matches the modal lightbox
          (DialogContent is bg-popover); in dark mode popover ≠ background. */}
      <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-popover">
        <ScreenViewer
          key={screen.id}
          screens={view.screens}
          flows={view.flows}
          initialScreenId={screen.id}
          appSlug={appSlug}
          appName={view.app.name}
          backHref={captureBase(appSlug, date, latest)}
          date={date}
          latest={latest}
          priorityInitial
          pinnedDate={pinnedDate}
        />
      </div>
    </>
  )
}
