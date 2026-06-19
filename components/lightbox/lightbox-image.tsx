"use client"

import Image from "next/image"
import { useState } from "react"
import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

// next/image with a loading skeleton. While the current src loads it shows an
// animate-pulse placeholder, then fades the image in. It tracks the *loaded src*
// (not a boolean) so swapping src (paging prev/next) re-shows the skeleton
// without remounting — an uncached image shows a placeholder instead of a blank
// flash. If the image fails to load (a shot-less screen → directory URL, a 404,
// or an optimizer error) it shows a static "unavailable" icon instead of pulsing
// forever. Fills its parent, which must be position-relative and sized.
export function LightboxImage({
  src,
  alt,
  sizes,
  preload,
  className,
  children,
}: {
  src: string
  alt: string
  sizes: string
  preload?: boolean
  className?: string
  /** Overlays (action buttons, state switcher) positioned over the image. */
  children?: React.ReactNode
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [erroredSrc, setErroredSrc] = useState<string | null>(null)
  const loaded = loadedSrc === src
  const errored = erroredSrc === src
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageOff className="h-8 w-8" aria-label="Image unavailable" />
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        onLoad={() => setLoadedSrc(src)}
        onError={() => setErroredSrc(src)}
        className={cn(
          "object-contain transition-opacity duration-200",
          loaded && !errored ? "opacity-100" : "opacity-0"
        )}
      />
      {children}
    </div>
  )
}
