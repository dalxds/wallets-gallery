"use client"

import type { FlowEntry, ScreenEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { FlowViewer } from "./flow-viewer"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useRouter } from "next/navigation"

// The modal form of the flow viewer: rendered by the @modal intercepting route
// over the gallery. Close = router.back(). The body is the SAME <FlowViewer> the
// standalone page uses — only this close-chrome differs.
export function FlowLightbox({
  flow,
  screens,
  appSlug,
  appName,
  date,
  initialIndex,
}: {
  flow: FlowEntry
  screens: ScreenEntry[]
  appSlug: string
  appName: string
  date: string
  initialIndex: number
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
        className="flex h-[85vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:h-[80vh] sm:max-w-[80vw]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{appName} flow</DialogTitle>
        <DialogDescription className="sr-only">
          Flow lightbox viewer
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

        <FlowViewer
          flow={flow}
          screens={screens}
          appSlug={appSlug}
          date={date}
          initialIndex={initialIndex}
        />
      </DialogContent>
    </Dialog>
  )
}
