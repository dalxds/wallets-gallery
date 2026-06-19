import Link from "next/link"
import { SiteHeader } from "@/components/layout/site-header"
import { FlowViewer } from "@/components/lightbox/flow-viewer"
import { galleryTabHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import type { AppCapture, FlowEntry } from "@/lib/types"

// The full-screen page form of the flow viewer — what a shared/refreshed
// /flow/[slug] link renders. Same <FlowViewer> as the modal; the only difference
// is this chrome (site navbar + app logo/name linking back to the gallery's flows
// tab + capture date). Server component; the viewer is the client island inside.
export function FlowPage({
  view,
  flow,
  appSlug,
  date,
  latest,
  initialIndex = 0,
}: {
  view: AppCapture
  flow: FlowEntry
  appSlug: string
  date: string
  latest: string
  initialIndex?: number
}) {
  return (
    <>
      <SiteHeader />
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
        <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://avatar.vercel.sh/${appSlug}`}
            alt={view.app.name}
            className="h-7 w-7 rounded-lg"
          />
          <Link
            href={galleryTabHref(appSlug, date, latest, "flows")}
            className="font-medium hover:underline"
          >
            {view.app.name}
          </Link>
          <span className="text-sm text-muted-foreground">
            {formatDate(date)}
          </span>
        </div>

        <FlowViewer
          key={`${flow.slug}:${initialIndex}`}
          flow={flow}
          screens={view.screens}
          appSlug={appSlug}
          date={date}
          initialIndex={initialIndex}
        />
      </div>
    </>
  )
}
