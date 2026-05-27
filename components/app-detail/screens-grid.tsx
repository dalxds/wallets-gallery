"use client"

import type { ScreenEntry } from "@/lib/types"
import { LazyImage } from "@/components/shared/lazy-image"
import { captureUrl } from "@/lib/images"
import { ImageActions } from "@/components/shared/image-actions"
import { useQueryState } from "nuqs"

interface ScreensGridProps {
  screens: ScreenEntry[]
  appSlug: string
}

export function ScreensGrid({ screens, appSlug }: ScreensGridProps) {
  const [, setScreen] = useQueryState("screen")

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {screens.map((screen) => {
        const src = captureUrl(appSlug, screen.screenshotPath)
        const screenUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/apps/${appSlug}/screens/${screen.id}`
        return (
          <div
            key={screen.id}
            role="button"
            tabIndex={0}
            onClick={() => setScreen(screen.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setScreen(screen.id)
              }
            }}
            className="group/card relative flex cursor-pointer flex-col gap-1.5 text-left"
          >
            <div className="relative overflow-hidden rounded-lg border transition-shadow group-hover/card:shadow-lg">
              <ImageActions src={src} screenUrl={screenUrl} />
              <LazyImage src={src} alt={screen.description} />
            </div>
            <p className="truncate text-xs font-medium">
              {screen.title}
            </p>
          </div>
        )
      })}
    </div>
  )
}
