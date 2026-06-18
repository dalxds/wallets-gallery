// The skeleton shown in the @modal slot while an intercepted screen/flow route's
// RSC payload is in flight (soft nav). It mirrors the lightbox dialog's chrome —
// a scrim + a centered phone placeholder — so a tile click feels instant; the
// real <Dialog> replaces it when the payload arrives. Plain divs (no Radix) so it
// paints immediately. Serves both the screen and flow modals.
export function ModalSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      aria-hidden
    >
      <div className="flex h-[95vh] w-full max-w-[95vw] flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
        {/* Chrome: app · date + close */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
        {/* Caption */}
        <div className="border-b px-4 py-2.5">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        {/* Stage: the phone-shaped placeholder */}
        <div className="flex flex-1 items-center justify-center bg-muted/30 p-6">
          <div className="aspect-[1080/2400] h-full max-w-full animate-pulse rounded-2xl bg-muted" />
        </div>
        {/* Footer: action buttons */}
        <div className="flex items-center justify-center gap-1.5 border-t px-4 py-3">
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}
