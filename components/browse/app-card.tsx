"use client"

import type { AppIndex } from "@/lib/types"
import { captureUrl } from "@/lib/images"
import { captureBase } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"

interface AppCardProps {
  app: AppIndex
  view: "grid" | "list"
}

export function AppCard({ app, view }: AppCardProps) {
  const screenCount = app.screens
  const flowCount = app.flows

  if (view === "list") {
    return (
      <Link
        href={captureBase(app.slug, app.latest)}
        className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
      href={captureBase(app.slug, app.latest)}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
    >
      {app.cover && (
        <div
          className="relative overflow-hidden rounded-lg border bg-muted"
          style={{ aspectRatio: "9/19.5" }}
        >
          <Image
            src={captureUrl(app.slug, app.cover)}
            alt={`${app.name} preview`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
