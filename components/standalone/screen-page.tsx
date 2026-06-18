import Image from "next/image"
import Link from "next/link"
import { captureUrl } from "@/lib/images"
import { appHref, captureBase, flowHref } from "@/lib/links"
import type { AppCapture, ScreenEntry } from "@/lib/types"

// The full standalone screen page — what a shared/refreshed /screen/[id] link
// renders (the modal is only shown on in-app soft navigation). Server component:
// crawlable, with its own OG card (sibling opengraph-image.tsx).
export function ScreenPage({
  view,
  screen,
  appSlug,
  date,
  latest,
}: {
  view: AppCapture
  screen: ScreenEntry
  appSlug: string
  date: string
  latest: string
}) {
  const flowNameBySlug = new Map(view.flows.map((f) => [f.slug, f.name]))
  const seen = new Set<string>()
  const foundIn: { slug: string; name: string }[] = []
  for (const a of screen.appearsIn ?? []) {
    if (seen.has(a.flow)) continue
    seen.add(a.flow)
    foundIn.push({ slug: a.flow, name: flowNameBySlug.get(a.flow) ?? a.flow })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={appHref(appSlug)}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {view.app.name}
        </Link>
        <Link
          href={captureBase(appSlug, date, latest)}
          className="text-sm font-medium hover:underline"
        >
          View in gallery →
        </Link>
      </div>

      <div
        className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-muted shadow-lg"
        style={{ aspectRatio: "9/19.5" }}
      >
        <Image
          src={captureUrl(appSlug, screen.screenshotPath)}
          alt={screen.description || screen.title}
          fill
          sizes="(min-width: 640px) 384px, 90vw"
          preload
          className="object-cover"
        />
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold">{screen.title}</h1>
        {screen.description && (
          <p className="text-muted-foreground">{screen.description}</p>
        )}
      </div>

      {foundIn.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Found in</span>
          {foundIn.map((f) => (
            <Link
              key={f.slug}
              href={flowHref(appSlug, f.slug, date, latest)}
              className="rounded-full bg-muted px-3 py-1 text-sm font-medium transition-colors hover:bg-accent"
            >
              {f.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
