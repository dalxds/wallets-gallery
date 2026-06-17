"use client"

import { useEffect } from "react"
import { useQueryState } from "nuqs"
import { toast } from "sonner"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import type { AppCapture } from "@/lib/types"

// Reads ?screen and renders the screen lightbox over the (server-rendered) grid.
// A sibling island — not an ancestor of the grid — so the grid stays in the
// static prerender; lives behind a <Suspense> because it reads searchParams, and
// renders nothing when no screen is selected.
export function ScreenLightboxIsland({
  screens,
  flows,
  appSlug,
  date,
}: {
  screens: AppCapture["screens"]
  flows: AppCapture["flows"]
  appSlug: string
  date: string
}) {
  const [activeScreenId, setScreen] = useQueryState("screen")
  const found = activeScreenId
    ? screens.some((s) => s.id === activeScreenId)
    : false

  // A deep link whose screen isn't in this capture (e.g. a permalink to a screen
  // a later capture dropped): tell the user instead of silently doing nothing,
  // and drop the dangling param so the URL reflects reality.
  useEffect(() => {
    if (activeScreenId && !found) {
      toast("That screen isn't in this capture", {
        id: `missing-screen-${activeScreenId}`,
        description: "It may have changed in a newer capture.",
      })
      setScreen(null)
    }
  }, [activeScreenId, found, setScreen])

  if (!activeScreenId || !found) return null
  return (
    <ScreenLightbox
      screens={screens}
      flows={flows}
      activeScreenId={activeScreenId}
      appSlug={appSlug}
      date={date}
    />
  )
}
