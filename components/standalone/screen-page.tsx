import { SiteHeader } from "@/components/layout/site-header"
import { ScreenViewer } from "@/components/lightbox/screen-viewer"
import { captureBase } from "@/lib/links"
import type { ClientCapture, ClientScreen } from "@/lib/types"

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
  appLogo,
  date,
}: {
  view: ClientCapture
  screen: ClientScreen
  appSlug: string
  appLogo: string | null
  date: string
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
          appLogo={appLogo}
          backHref={captureBase(appSlug, date)}
          date={date}
          priorityInitial
        />
      </div>
    </>
  )
}
