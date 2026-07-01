"use client"

import type { FlowEntry, ScreenEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { FlowViewer } from "./flow-viewer"
import { flowsHref } from "@/lib/links"
import { useRouter } from "next/navigation"

// The modal form of the flow viewer: rendered by the @modal intercepting route
// over the gallery. Close = router.back(). The body is the SAME <FlowViewer> the
// standalone page uses — header, strip, and bottom bar all live in the viewer; this
// wrapper only adds the Dialog and the close handler.
export function FlowLightbox({
  flow,
  screens,
  appSlug,
  appName,
  appLogo,
  date,
}: {
  flow: FlowEntry
  screens: ScreenEntry[]
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
        className="flex h-[85vh] max-w-[95vw] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[80vh] sm:max-w-[80vw]"
        showCloseButton={false}
        animate={false}
      >
        <DialogTitle className="sr-only">{appName} flow</DialogTitle>
        <DialogDescription className="sr-only">
          Flow lightbox viewer
        </DialogDescription>

        <FlowViewer
          key={flow.slug}
          flow={flow}
          screens={screens}
          appSlug={appSlug}
          appName={appName}
          appLogo={appLogo}
          backHref={flowsHref(appSlug, date)}
          date={date}
          onClose={() => router.back()}
        />
      </DialogContent>
    </Dialog>
  )
}
