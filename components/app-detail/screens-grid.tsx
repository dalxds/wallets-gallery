import type { ScreenEntry } from "@/lib/types"
import { captureUrl } from "@/lib/images"
import { ImageActions } from "@/components/shared/image-actions"
import { screenHref } from "@/lib/links"
import {
  ScreensGridLayout,
  ScreenTile,
  screenTileWrapperClass,
} from "@/components/app-detail/screen-tile"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ScreensGridProps {
  screens: ScreenEntry[]
  appSlug: string
  /** Capture date — pins the copy-link permalink to this capture. */
  date: string
}

// Server-rendered: each tile is a real <Link> into ?screen, so the grid lives in
// the static HTML (crawlable, no first-paint swap, works without JS). A plain
// <img> — not the client LazyImage — so the screenshots are visible in the
// prerendered HTML rather than hidden at opacity-0 until hydration; the muted box
// is the loading placeholder. The screen lightbox is a separate client island
// that reads ?screen. Hover actions sit as an absolutely-positioned sibling of
// the link — not inside it — so the buttons stay valid markup (no button-in-
// anchor) and don't trigger navigation.
export function ScreensGrid({ screens, appSlug, date }: ScreensGridProps) {
  return (
    <ScreensGridLayout>
      {screens.map((screen) => {
        const src = captureUrl(appSlug, screen.screenshotPath)
        // Relative href for in-app navigation: resolves against the current
        // path, so clicking keeps you on whichever capture you're viewing
        // (clean stays clean, dated stays dated).
        const href = `?tab=screens&screen=${encodeURIComponent(screen.id)}`
        return (
          <div
            key={screen.id}
            className={cn(screenTileWrapperClass, "group/card relative")}
          >
            <Link
              href={href}
              aria-label={screen.title || screen.id}
              className="block cursor-zoom-in"
            >
              <ScreenTile
                imageBoxClassName="relative bg-muted transition-shadow group-hover/card:shadow-lg"
                imageBoxStyle={{ aspectRatio: "9/19.5" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={screen.description}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </ScreenTile>
            </Link>
            {/* Copy-link pins the dated permalink (never drifts off latest). */}
            <ImageActions
              src={src}
              shareHref={screenHref(appSlug, date, screen.id)}
            />
          </div>
        )
      })}
    </ScreensGridLayout>
  )
}
