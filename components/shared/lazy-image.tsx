"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  aspectRatio?: string
}

export function LazyImage({
  src,
  alt,
  className,
  aspectRatio = "9/19.5",
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ aspectRatio }}
    >
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}
