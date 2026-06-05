import { AppShell } from "@/components/layout/app-shell"
import { captureUrl } from "@/lib/images"
import { screenHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import type { AppCapture, AppIndex } from "@/lib/types"
import Link from "next/link"

// Server-rendered default view (Screens tab) used as the <Suspense> fallback.
// The interactive client subtree reads search params (nuqs → useSearchParams),
// which bails out of static rendering — so the static HTML would otherwise be a
// skeleton. Rendering the real screens here puts actual content (images +
// titles) into the prerendered HTML for crawlers/LLMs and first paint; the
// client takes over on hydration. Kept free of any search-param reads itself.
export function AppDetailStatic({
  view,
  appIndex,
  appSlug,
}: {
  view: AppCapture
  appIndex: AppIndex
  appSlug: string
}) {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://avatar.vercel.sh/${appSlug}`}
            alt={view.app.name}
            className="h-16 w-16 rounded-2xl"
          />
          <div>
            <h1 className="text-2xl font-bold">{view.app.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatDate(appIndex.latest)}</span>
              <span>·</span>
              <span>{view.screens.length} screens</span>
              <span>·</span>
              <span>{view.flows.length} flows</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 border-b">
          <span className="border-b-2 border-primary pb-2 text-sm font-medium">
            Screens ({view.screens.length})
          </span>
          <span className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground">
            Flows ({view.flows.length})
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {view.screens.map((screen) => (
          <Link
            key={screen.id}
            href={screenHref(appSlug, screen.id)}
            className="flex flex-col gap-1.5 text-left"
          >
            <div
              className="overflow-hidden rounded-lg border"
              style={{ aspectRatio: "9/19.5" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={captureUrl(appSlug, screen.screenshotPath)}
                alt={screen.description}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="truncate text-xs font-medium">{screen.title}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}
