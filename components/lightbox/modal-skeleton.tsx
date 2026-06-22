import { cn } from "@/lib/utils"

// The skeleton shown in the @modal slot while an intercepted screen/flow route's
// RSC payload is in flight (soft nav). It mirrors the lightbox <Dialog> EXACTLY —
// same scrim (bg-black/10 + blur, not a dark overlay), same frame (rounded-xl,
// ring, popover bg), the same per-variant size, AND the same one-row header +
// 3-column footer the real viewer uses — so when the real Dialog arrives it drops
// in place with no scrim flash, no resize, no row reflow, and no re-animation (the
// lightboxes render with animate={false}). Plain divs (no Radix) so it paints
// immediately on the tile click.
export function ModalSkeleton({ variant }: { variant: "screen" | "flow" }) {
  const isScreen = variant === "screen"
  // Match each lightbox's DialogContent size so the frame doesn't jump on swap.
  const sizeClass = isScreen
    ? "h-[95vh] max-w-[95vw]"
    : "h-[85vh] max-w-[95vw] sm:h-[80vh] sm:max-w-[80vw]"
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
      // Lets globals.css hide the page scrollbar from the instant the skeleton
      // paints — matching the Dialog's scroll lock — so the thumb doesn't linger
      // over the skeleton and blink off a beat later when the Dialog mounts.
      data-modal-open
      aria-hidden
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-2xl bg-popover ring-1 ring-foreground/10",
          sizeClass
        )}
      >
        {/* Header: app logo + name · divider · current title · close (one row) */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted" />
        </div>

        {/* Stage: the phone-shaped placeholder */}
        <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
          <div className="aspect-[1080/2400] h-full max-w-full animate-pulse rounded-2xl bg-muted" />
        </div>

        {/* Footer: count/chip · actions · capture date (3-column grid) */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t px-4 py-3">
          <div className="flex items-center">
            <div
              className={cn(
                "animate-pulse bg-muted",
                isScreen ? "h-6 w-28 rounded-full" : "h-4 w-16 rounded"
              )}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
            <div
              className={cn(
                "h-8 animate-pulse rounded-md bg-muted",
                isScreen ? "w-20" : "w-28"
              )}
            />
            {isScreen && (
              <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
            )}
          </div>
          <div className="flex items-center justify-end">
            <div
              className={cn(
                "h-4 animate-pulse rounded bg-muted",
                isScreen ? "w-28" : "w-20"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
