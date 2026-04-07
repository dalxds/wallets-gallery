"use client"

import { AppShell } from "@/components/layout/app-shell"
import { ScreenLightbox } from "@/components/lightbox/screen-lightbox"
import { getAppsIndex, fetchAppCapture } from "@/lib/data"
import type { AppCapture, AppIndex } from "@/lib/types"
import { useParams, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function ScreenDetailPage() {
  const params = useParams<{ slug: string; screenId: string }>()
  const searchParams = useSearchParams()
  const [app, setApp] = useState<AppCapture | null>(null)
  const [appIndex, setAppIndex] = useState<AppIndex | null>(null)
  const [loading, setLoading] = useState(true)

  const slug = params.slug
  const screenId = params.screenId

  useEffect(() => {
    async function load() {
      const registry = await getAppsIndex()
      const idx = registry.apps.find((a) => a.slug === slug)
      if (!idx) return
      setAppIndex(idx)

      const date = searchParams.get("date") ?? idx.latest
      const capture = await fetchAppCapture(slug, date)
      setApp(capture)
      setLoading(false)
    }
    load()
  }, [slug, searchParams])

  const date =
    searchParams.get("date") ?? appIndex?.latest ?? ""

  if (loading || !app) {
    return (
      <AppShell>
        <div className="h-96 animate-pulse rounded bg-muted" />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <ScreenLightbox
        screens={app.screens}
        activeScreenId={screenId}
        appSlug={slug}
        date={date}
      />
    </AppShell>
  )
}
