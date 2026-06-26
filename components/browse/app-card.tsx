import type { AppIndex } from "@/lib/types"
import { captureBase } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import Link from "next/link"

interface AppCardProps {
  app: AppIndex
}

export function AppCard({ app }: AppCardProps) {
  return (
    <Link
      href={captureBase(app.slug, app.latest)}
      className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://avatar.vercel.sh/${app.slug}`}
        alt={app.name}
        className="h-12 w-12 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{app.name}</h3>
        <span className="text-sm text-muted-foreground">
          {formatDate(app.latest)}
        </span>
      </div>
    </Link>
  )
}
