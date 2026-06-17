"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { appHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"

// Renders nothing; on mount it surfaces a toast when the viewed capture is an
// older permalink (date !== latest) — the signal that lets a stale shared link
// be a useful dead-end instead of a silent one. The action jumps to the clean
// /apps/[slug], which always tracks the latest capture.
export function CaptureNotice({
  slug,
  date,
  latest,
}: {
  slug: string
  date: string
  latest: string
}) {
  const router = useRouter()

  useEffect(() => {
    if (date === latest) return
    // Stable id: one notice per app+date, so a re-render (or dev double-mount)
    // updates rather than stacks duplicates.
    toast(`Viewing the ${formatDate(date)} capture`, {
      id: `older-capture-${slug}-${date}`,
      description: "A newer capture is available.",
      duration: 10000,
      action: {
        label: "View latest",
        onClick: () => router.push(appHref(slug)),
      },
    })
  }, [slug, date, latest, router])

  return null
}
