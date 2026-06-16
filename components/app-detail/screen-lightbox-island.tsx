"use client"

import { useQueryState } from "nuqs"
import { useMaskedLightboxParam } from "@/hooks/use-restored-lightbox-params"
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
}: {
  screens: AppCapture["screens"]
  flows: AppCapture["flows"]
  appSlug: string
}) {
  const [rawScreenId] = useQueryState("screen")
  // Mask a ?screen restored by the router-cache bug; LightboxParamGuard clears it.
  const activeScreenId = useMaskedLightboxParam(rawScreenId)
  if (!activeScreenId || !screens.some((s) => s.id === activeScreenId)) return null
  return (
    <ScreenLightbox
      screens={screens}
      flows={flows}
      activeScreenId={activeScreenId}
      appSlug={appSlug}
    />
  )
}
