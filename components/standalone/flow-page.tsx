import Image from "next/image"
import Link from "next/link"
import { captureUrl } from "@/lib/images"
import { appHref, captureBase } from "@/lib/links"
import type { AppCapture, FlowEntry } from "@/lib/types"

// The full standalone flow page — what a shared/refreshed /flow/[slug] link
// renders (the modal is only shown on in-app soft navigation). Server component:
// crawlable, with its own OG card (sibling opengraph-image.tsx).
export function FlowPage({
  view,
  flow,
  appSlug,
  date,
  latest,
}: {
  view: AppCapture
  flow: FlowEntry
  appSlug: string
  date: string
  latest: string
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8">
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

      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{flow.name}</h1>
        <p className="text-sm text-muted-foreground">
          {flow.steps.length} {flow.steps.length === 1 ? "screen" : "screens"}
          {flow.summary ? ` · ${flow.summary}` : ""}
        </p>
      </div>

      <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
        {flow.steps.map((step) => (
          <div
            key={step.number}
            className="flex w-40 shrink-0 flex-col items-center gap-2"
          >
            <div
              className="relative w-full overflow-hidden rounded-lg border bg-muted shadow-sm"
              style={{ aspectRatio: "9/19.5" }}
            >
              <Image
                src={captureUrl(appSlug, step.screenshotPath)}
                alt={step.title}
                fill
                sizes="160px"
                className="object-cover"
              />
            </div>
            <span className="text-center text-xs text-muted-foreground">
              {step.number}. {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
