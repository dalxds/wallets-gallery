"use client"

import type { FlowEntry } from "@/lib/types"
import type { StateIndex } from "@/lib/states"
import { captureUrl } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, Link2, Layers } from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { ImageActions } from "@/components/shared/image-actions"
import { flowHref } from "@/lib/links"
import Link from "next/link"

interface FlowRowProps {
  flow: FlowEntry
  appSlug: string
  stateIndex: StateIndex
  /** Set for nested flows — surfaced as "… from {parent}" in the title. */
  parent?: { slug: string; name: string }
  /** Scroll to another flow in the list (used by the parent link). */
  onNavigate?: (slug: string) => void
}

// Reads no searchParams, so it server-renders into the static HTML (visible
// screenshots via plain <img>, crawlable) while keeping its scroll affordances
// and copy-link as client interactivity. Each step is a <Link> into ?flow/?step;
// the FlowLightboxIsland reads those and opens the lightbox.
export function FlowRow({
  flow,
  appSlug,
  stateIndex,
  parent,
  onNavigate,
}: FlowRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  useEffect(() => {
    updateScrollState()
  }, [flow])

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  async function copyFlowLink(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}${flowHref(appSlug, flow.slug)}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <h3 className="min-w-0 font-medium">
          {flow.name}
          {parent && (
            <>
              <span className="font-normal text-muted-foreground"> from </span>
              <button type="button" onClick={() => onNavigate?.(parent.slug)}>
                {parent.name}
              </button>
            </>
          )}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {flow.steps.length} {flow.steps.length === 1 ? "screen" : "screens"}
            {flow.summary ? ` · ${flow.summary}` : ""}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copyFlowLink}
            aria-label="Copy link to flow"
            className="text-muted-foreground"
          >
            {linkCopied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div className="relative">
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-1 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 scrollbar-hide"
          onScroll={updateScrollState}
        >
          {flow.steps.map((step, idx) => {
            const stateCount = stateIndex.variantsForScreen(step.screenId).length
            const src = captureUrl(appSlug, step.screenshotPath)
            // Relative href: opens the lightbox via the URL and keeps the date.
            const href = `?tab=flows&flow=${encodeURIComponent(flow.slug)}&step=${idx}`
            return (
              <div
                key={step.number}
                className="group/step group/card relative w-32 shrink-0 snap-start text-left sm:w-36"
              >
                <Link
                  href={href}
                  aria-label={step.title}
                  className="block cursor-zoom-in"
                >
                  <div
                    className="relative overflow-hidden rounded-lg border bg-muted transition-shadow group-hover/step:shadow-md"
                    style={{ aspectRatio: "9/19.5" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={step.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {stateCount > 1 && (
                      <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                        <Layers className="h-2.5 w-2.5" />
                        {stateCount} states
                      </div>
                    )}
                  </div>
                </Link>
                <ImageActions src={src} shareHref={href} />
              </div>
            )
          })}
        </div>
        {canScrollRight && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-1 top-1/2 z-10 h-8 w-8 -translate-y-1/2 rounded-full shadow-md"
            onClick={() => scroll("right")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
