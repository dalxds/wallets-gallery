import Link from "next/link"
import { SiteHeader } from "@/components/layout/site-header"
import { ScreenViewer } from "@/components/lightbox/screen-viewer"
import { galleryTabHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import type { AppCapture, ScreenEntry } from "@/lib/types"

// The full-screen page form of the screen viewer — what a shared/refreshed
// /screen/[id] link renders. Same <ScreenViewer> as the modal; the only
// difference is this chrome (site navbar + app logo/name linking back to the
// gallery's screens tab + capture date). Server component (crawlable, with its
// own OG card); the viewer is the client island inside it.
export function ScreenPage({
  view,
  screen,
  appSlug,
  date,
  latest,
}: {
  view: AppCapture
  screen: ScreenEntry
  appSlug: string
  date: string
  latest: string
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
            href={galleryTabHref(appSlug, date, latest, "screens")}
            className="font-medium hover:underline"
          >
            {view.app.name}
          </Link>
          <span className="text-sm text-muted-foreground">
            {formatDate(date)}
          </span>
        </div>

        <ScreenViewer
          screens={view.screens}
          flows={view.flows}
          initialScreenId={screen.id}
          appSlug={appSlug}
          date={date}
          latest={latest}
          priorityInitial
        />
      </div>
    </>
  )
}
