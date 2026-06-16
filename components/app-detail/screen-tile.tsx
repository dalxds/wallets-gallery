import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

// Shared layout primitives for the (server-rendered) screens grid: the column
// template and the card frame, kept here as one source of truth.

// The responsive column grid that holds the cards. `className` lets the caller
// add spacing.
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

// Base classes for a card's wrapper; the caller appends interaction classes.
export const screenTileWrapperClass = "flex flex-col gap-1.5 text-left"

// A card's frame: the bordered image box. The image (and any hover overlay) is
// passed as `children` by the caller.
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
