"use client"

import type { AppIndex, AppCapture } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

interface AppCardProps {
  app: AppIndex
  capture?: AppCapture
  view: "grid" | "list"
}

export function AppCard({ app, capture, view }: AppCardProps) {
  const screenCount = capture?.screens.length ?? 0
  const flowCount = capture?.flows.length ?? 0

  if (view === "list") {
    return (
      <Link
        href={`/apps/${app.slug}`}
        className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
      >
        <img
          src={`https://avatar.vercel.sh/${app.slug}`}
          alt={app.name}
          className="h-10 w-10 rounded-xl"
        />
        <div className="flex-1">
          <h3 className="font-semibold">{app.name}</h3>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>{screenCount} screens</span>
          <span>{flowCount} flows</span>
          <span className="w-28 text-right">{formatDate(app.latest)}</span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-3">
        <img
          src={`https://avatar.vercel.sh/${app.slug}`}
          alt={app.name}
          className="h-12 w-12 rounded-xl"
        />
        <div className="flex-1">
          <h3 className="font-semibold">{app.name}</h3>
          <span className="text-sm text-muted-foreground">
            {formatDate(app.latest)}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{screenCount} screens</span>
        <span>{flowCount} flows</span>
      </div>
    </Link>
  )
}
