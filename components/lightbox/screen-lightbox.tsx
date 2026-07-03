"use client"

import type { ClientFlow, ClientScreen } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScreenViewer } from "./screen-viewer"
import { captureBase } from "@/lib/links"
import { useRouter } from "next/navigation"

// The modal form of the screen viewer: rendered by the @modal intercepting route
// over the gallery. Close = router.back() (returns to the gallery). The body is
// the SAME <ScreenViewer> the standalone page uses — header, stage, and footer
// all live in the viewer, so the two forms can't drift; this wrapper only adds
// the Dialog and the close handler. Prev/next inside the viewer never navigate
// the router, so the modal doesn't flicker.
export function ScreenLightbox({
  screens,
  flows,
  activeScreenId,
  appSlug,
  appName,
  appLogo,
  date,
}: {
  screens: ClientScreen[]
  flows: ClientFlow[]
  activeScreenId: string
  appSlug: string
  appName: string
  appLogo: string | null
  date: string
}) {
  const router = useRouter()
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) router.back()
      }}
    >
      <DialogContent
        className="flex h-[95vh] max-w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[95vw]"
        showCloseButton={false}
        animate={false}
      >
        <DialogTitle className="sr-only">{appName} screen</DialogTitle>
        <DialogDescription className="sr-only">
          Screen lightbox viewer
        </DialogDescription>

        <ScreenViewer
          key={activeScreenId}
          screens={screens}
          flows={flows}
          initialScreenId={activeScreenId}
          appSlug={appSlug}
          appName={appName}
          appLogo={appLogo}
          backHref={captureBase(appSlug, date)}
          date={date}
          onClose={() => router.back()}
        />
      </DialogContent>
    </Dialog>
  )
}
