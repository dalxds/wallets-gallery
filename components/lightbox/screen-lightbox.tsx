"use client"

import type { FlowEntry, ScreenEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScreenViewer } from "./screen-viewer"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

// The modal form of the screen viewer: rendered by the @modal intercepting route
// over the gallery. Close = router.back() (returns to the gallery). The body is
// the SAME <ScreenViewer> the standalone page uses — only this close-chrome
// differs. Prev/next inside the viewer never navigate the router, so the modal
// doesn't flicker.
export function ScreenLightbox({
  screens,
  flows,
  activeScreenId,
  appSlug,
  appName,
  date,
  latest,
}: {
  screens: ScreenEntry[]
  flows: FlowEntry[]
  activeScreenId: string
  appSlug: string
  appName: string
  date: string
  latest: string
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
        className="flex h-[95vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{appName} screen</DialogTitle>
        <DialogDescription className="sr-only">
          Screen lightbox viewer
        </DialogDescription>

        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0 truncate text-sm text-muted-foreground">
            {appName} · {formatDate(date)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScreenViewer
          key={activeScreenId}
          screens={screens}
          flows={flows}
          initialScreenId={activeScreenId}
          appSlug={appSlug}
          date={date}
          latest={latest}
        />
      </DialogContent>
    </Dialog>
  )
}
