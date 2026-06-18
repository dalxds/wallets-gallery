"use client"

import { useRouter } from "next/navigation"
import { ScreenLightbox } from "./screen-lightbox"
import { screenHref, flowHref } from "@/lib/links"
import type { FlowEntry, ScreenEntry } from "@/lib/types"

// Route-driven wrapper around <ScreenLightbox>: rendered by the @modal slot's
// intercepting route, so close = router.back() (pops to the gallery) and prev/
// next reflect onto the canonical URL via router.replace (no history spam).
export function ScreenModal({
  screens,
  flows,
  activeScreenId,
  appSlug,
  date,
  latest,
}: {
  screens: ScreenEntry[]
  flows: FlowEntry[]
  activeScreenId: string
  appSlug: string
  date: string
  latest: string
}) {
  const router = useRouter()
  return (
    <ScreenLightbox
      screens={screens}
      flows={flows}
      activeScreenId={activeScreenId}
      appSlug={appSlug}
      date={date}
      latest={latest}
      onClose={() => router.back()}
      onNavigate={(id) =>
        router.replace(screenHref(appSlug, id, date, latest), { scroll: false })
      }
      onOpenFlow={(slug, step) =>
        router.push(flowHref(appSlug, slug, date, latest, step))
      }
    />
  )
}
