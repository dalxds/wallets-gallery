"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"

// next/image with a loading skeleton. While the current src loads it shows an
// animate-pulse placeholder, then fades the image in. It tracks the *loaded src*
// (not a boolean) so swapping src (paging prev/next) re-shows the skeleton
// without remounting — an uncached image shows a placeholder instead of a blank
// flash. Fills its parent, which must be position-relative and sized.
export function LightboxImage({
  src,
  alt,
  sizes,
  preload,
  className,
  imgClassName,
  children,
}: {
  src: string
  alt: string
  sizes: string
  preload?: boolean
  className?: string
  imgClassName?: string
  /** Overlays (action buttons, state switcher) positioned over the image. */
  children?: React.ReactNode
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const loaded = loadedSrc === src
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />
      )}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        onLoad={() => setLoadedSrc(src)}
        className={cn(
          "object-contain transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
      />
      {children}
    </div>
  )
}
