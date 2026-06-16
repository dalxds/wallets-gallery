"use client"

import type { ScreenEntry } from "@/lib/types"
import { LazyImage } from "@/components/shared/lazy-image"
import { captureUrl } from "@/lib/images"
import { screenHref } from "@/lib/links"
import { ImageActions } from "@/components/shared/image-actions"
import {
  ScreensGridLayout,
  ScreenTile,
  screenTileWrapperClass,
} from "@/components/app-detail/screen-tile"
import { cn } from "@/lib/utils"
import { useQueryState } from "nuqs"

interface ScreensGridProps {
  screens: ScreenEntry[]
  appSlug: string
}

export function ScreensGrid({ screens, appSlug }: ScreensGridProps) {
  const [, setScreen] = useQueryState("screen")

  return (
    <ScreensGridLayout>
      {screens.map((screen) => {
        const src = captureUrl(appSlug, screen.screenshotPath)
        const screenUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${screenHref(appSlug, screen.id)}`
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
            className={cn(
              screenTileWrapperClass,
              "group/card relative cursor-pointer"
            )}
          >
            <ScreenTile
              title={screen.title}
              imageBoxClassName="relative transition-shadow group-hover/card:shadow-lg"
            >
              <ImageActions src={src} screenUrl={screenUrl} />
              <LazyImage src={src} alt={screen.description} />
            </ScreenTile>
          </div>
        )
      })}
    </ScreensGridLayout>
  )
}
