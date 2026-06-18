"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { FlowLightbox } from "./flow-lightbox"
import { buildStateIndex } from "@/lib/states"
import type { FlowEntry, ScreenEntry } from "@/lib/types"

// Route-driven wrapper around <FlowLightbox>: rendered by the @modal slot's
// intercepting route. The state index is built here (client) from the screens —
// it holds a closure, so it can't cross the server→client boundary as a prop.
export function FlowModal({
  flow,
  screens,
  appSlug,
  date,
  latest,
  initialIndex,
}: {
  flow: FlowEntry
  screens: ScreenEntry[]
  appSlug: string
  date: string
  latest: string
  initialIndex: number
}) {
  const router = useRouter()
  const stateIndex = useMemo(() => buildStateIndex(screens), [screens])
  return (
    <FlowLightbox
      flow={flow}
      appSlug={appSlug}
      date={date}
      latest={latest}
      initialIndex={initialIndex}
      stateIndex={stateIndex}
      onClose={() => router.back()}
    />
  )
}
