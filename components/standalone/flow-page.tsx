import { SiteHeader } from "@/components/layout/site-header"
import { FlowViewer } from "@/components/lightbox/flow-viewer"
import { flowsHref } from "@/lib/links"
import type { AppCapture, FlowEntry } from "@/lib/types"

// The full-screen page form of the flow viewer — what a shared/refreshed
// /flow/[slug] link renders. Same <FlowViewer> as the modal (header, strip, and
// bottom bar all live in the viewer); the only difference is this chrome: the site
// navbar on top, and no close button. The viewer's header logo/name links back to
// the capture's flows tab (its date). Server component; the viewer is the client
// island inside.
export function FlowPage({
  view,
  flow,
  appSlug,
  date,
}: {
  view: AppCapture
  flow: FlowEntry
  appSlug: string
  date: string
}) {
  return (
    <>
      <SiteHeader />
      {/* bg-popover so the header/footer/stage surface matches the modal lightbox
          (DialogContent is bg-popover); in dark mode popover ≠ background. */}
      <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-popover">
        <FlowViewer
          key={flow.slug}
          flow={flow}
          screens={view.screens}
          appSlug={appSlug}
          appName={view.app.name}
          backHref={flowsHref(appSlug, date)}
          date={date}
        />
      </div>
    </>
  )
}
