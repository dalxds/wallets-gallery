"use client"

import type { ScreenEntry } from "@/lib/types"
import { LazyImage } from "@/components/shared/lazy-image"
import { captureUrl } from "@/lib/images"
import { formatScreenId } from "@/lib/utils"
import { ImageActions } from "@/components/shared/image-actions"
import Link from "next/link"

interface ScreensGridProps {
  screens: ScreenEntry[]
  appSlug: string
  date: string
}

export function ScreensGrid({ screens, appSlug, date }: ScreensGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {screens.map((screen) => {
        const src = captureUrl(appSlug, date, screen.screenshotPath)
        const screenUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/apps/${appSlug}/screens/${screen.id}`
        return (
          <Link
            key={screen.id}
            href={`/apps/${appSlug}/screens/${screen.id}`}
            className="group/card relative flex flex-col gap-1.5"
          >
            <div className="relative overflow-hidden rounded-lg border transition-shadow group-hover/card:shadow-lg">
              <ImageActions src={src} screenUrl={screenUrl} />
              <LazyImage src={src} alt={screen.description} />
            </div>
            <p className="truncate text-xs font-medium">
              {formatScreenId(screen.id)}
            </p>
          </Link>
        )
      })}
    </div>
  )
}
