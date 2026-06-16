import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

// The screens grid is rendered twice: by the interactive client (ScreensGrid)
// and by the search-param-free <Suspense> fallback (AppDetailStatic). The grid
// template and card frame live here as the single source of truth — any drift
// would show as a jump when the client hydrates over the static HTML. Only the
// interactive parts (how a card opens, how its image loads) differ and stay
// with each caller.

// The responsive column grid that holds the cards. `className` lets the caller
// add spacing — the static fallback passes `mt-6`; the client keeps that margin
// on an outer wrapper so the chrome can collapse it on the Flows tab.
export function ScreensGridLayout({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
        className
      )}
    >
      {children}
    </div>
  )
}

// Base classes for a card's clickable wrapper — a <Link> in the static
// fallback, a <div role="button"> in the client. Both start from these so the
// card footprint matches, then append their own interaction classes.
export const screenTileWrapperClass = "flex flex-col gap-1.5 text-left"

// A card's non-interactive frame: the bordered image box. The image is passed
// as `children` because the static fallback renders a plain <img> (real content
// for crawlers, no JS) while the client renders a <LazyImage> with a hover
// <ImageActions> overlay.
export function ScreenTile({
  imageBoxClassName,
  imageBoxStyle,
  children,
}: {
  imageBoxClassName?: string
  imageBoxStyle?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-lg border", imageBoxClassName)}
      style={imageBoxStyle}
    >
      {children}
    </div>
  )
}
