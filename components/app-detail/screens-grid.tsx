import type { ScreenEntry } from "@/lib/types"
import { captureUrl } from "@/lib/images"
import { screenDownloadName } from "@/lib/clipboard"
import { ImageActions } from "@/components/shared/image-actions"
import {
  ScreensGridLayout,
  ScreenTile,
  screenTileWrapperClass,
} from "@/components/app-detail/screen-tile"
import { screenHref } from "@/lib/links"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

interface ScreensGridProps {
  screens: ScreenEntry[]
  appSlug: string
  date: string
}

// Server-rendered: each tile is a real <Link> to /apps/[slug]/[date]/screen/[id]
// (every capture is canonical at its dated URL). In-app that link is intercepted
// into the lightbox modal (interception lives under [date]); opened directly it
// renders the standalone page. The grid lives in the static HTML (crawlable).
// Hover actions sit as an absolutely-positioned sibling of the link — not inside
// it — so the buttons stay valid markup (no button-in-anchor) and don't trigger
// navigation.
export function ScreensGrid({ screens, appSlug, date }: ScreensGridProps) {
  return (
    <ScreensGridLayout>
      {screens.map((screen) => {
        const src = captureUrl(appSlug, screen.screenshotPath)
        // The tile link and the copy-link share the same dated URL — the tile
        // click is intercepted into the modal, a direct open renders the page.
        const href = screenHref(appSlug, screen.id, date)
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
                {/* Lazy so only in-viewport tiles fetch as the grid scrolls,
                    rather than the whole capture at once. */}
                <Image
                  src={src}
                  alt={screen.description}
                  fill
                  loading="lazy"
                  sizes="(min-width:1536px) 14vw, (min-width:1280px) 16vw, (min-width:1024px) 20vw, (min-width:768px) 25vw, (min-width:640px) 33vw, 50vw"
                  className="object-cover"
                />
              </ScreenTile>
            </Link>
            <ImageActions
              src={src}
              shareHref={href}
              downloadName={screenDownloadName(appSlug, screen.id)}
            />
          </div>
        )
      })}
    </ScreensGridLayout>
  )
}
