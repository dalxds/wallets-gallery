"use client"

import { useEffect } from "react"
import { useQueryState } from "nuqs"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import { followAlias } from "@/lib/links"
import type { AppCapture } from "@/lib/types"

// Reads ?screen and renders the screen lightbox over the (server-rendered) grid.
// A sibling island — not an ancestor of the grid — so the grid stays in the
// static prerender; lives behind a <Suspense> because it reads searchParams, and
// renders nothing when no screen is selected.
export function ScreenLightboxIsland({
  screens,
  flows,
  aliases,
  appSlug,
}: {
  screens: AppCapture["screens"]
  flows: AppCapture["flows"]
  /** Retired→current screen-id redirects (view.screenAliases) so stale links still resolve. */
  aliases: AppCapture["screenAliases"]
  appSlug: string
}) {
  const [screenParam, setScreenParam] = useQueryState("screen")
  // Resolve the id directly, then via one alias hop for links shared before a
  // re-capture renamed/merged the node.
  const canonical = screenParam ? followAlias(screenParam, aliases) : null
  const active = canonical && screens.some((s) => s.id === canonical) ? canonical : null

  // Self-heal the URL when we resolved through an alias.
  useEffect(() => {
    if (active && screenParam && screenParam !== active) setScreenParam(active)
  }, [active, screenParam, setScreenParam])

  if (!active) return null
  return (
    <ScreenLightbox
      screens={screens}
      flows={flows}
      activeScreenId={active}
      appSlug={appSlug}
    />
  )
}
