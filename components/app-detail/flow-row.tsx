"use client"

import type { FlowEntry } from "@/lib/types"
import type { StateIndex } from "@/lib/states"
import { LazyImage } from "@/components/shared/lazy-image"
import { captureUrl } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, Link2, Layers } from "lucide-react"
import { useRef, useState, useEffect, useCallback } from "react"
import { useQueryState } from "nuqs"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"
import { ImageActions } from "@/components/shared/image-actions"
import { flowHref } from "@/lib/links"

interface FlowRowProps {
  flow: FlowEntry
  appSlug: string
  stateIndex: StateIndex
}

export function FlowRow({ flow, appSlug, stateIndex }: FlowRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [flowParam, setFlowParam] = useQueryState("flow")
  const [stepParam, setStepParam] = useQueryState("step")

  // The lightbox is derived from the URL (single source of truth): this flow's
  // lightbox is open whenever ?flow matches its slug, at the ?step index. This
  // also covers deep links that arrive after mount (e.g. via search) without
  // mirroring URL state into an effect.
  const isLightboxOpen = flowParam === flow.slug
  const parsedStep = stepParam ? parseInt(stepParam, 10) : 0
  const initialStep = Number.isNaN(parsedStep) ? 0 : parsedStep

  const openLightbox = useCallback(
    (idx: number) => {
      setFlowParam(flow.slug)
      setStepParam(String(idx))
    },
    [flow.slug, setFlowParam, setStepParam]
  )

  const closeLightbox = useCallback(() => {
    setFlowParam(null)
    setStepParam(null)
  }, [setFlowParam, setStepParam])

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

  function getStepLabel(step: (typeof flow.steps)[0]): string {
    if (
      step.action.toLowerCase() === "entry point" ||
      step.action.toLowerCase() === "entry"
    ) {
      return step.title
    }
    return step.action
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{flow.name}</h3>
          <p className="text-sm text-muted-foreground">{flow.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyFlowLink}
            className="h-7 gap-1 text-xs text-muted-foreground"
          >
            {linkCopied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Link2 className="h-3 w-3" />
            )}
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground">
            {flow.steps.length} {flow.steps.length === 1 ? "step" : "steps"}
          </span>
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
            return (
            <div
              key={step.number}
              role="button"
              tabIndex={0}
              onClick={() => openLightbox(idx)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  openLightbox(idx)
                }
              }}
              className="group/step w-32 shrink-0 cursor-pointer snap-start text-left sm:w-36"
            >
              <div className="group/card relative overflow-hidden rounded-lg border transition-shadow group-hover/step:shadow-md">
                <ImageActions
                  src={captureUrl(appSlug, step.screenshotPath)}
                  screenUrl={`${typeof window !== "undefined" ? window.location.origin : ""}${flowHref(appSlug, flow.slug, idx)}`}
                />
                <LazyImage
                  src={captureUrl(appSlug, step.screenshotPath)}
                  alt={step.title}
                />
                {stateCount > 1 && (
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                    <Layers className="h-2.5 w-2.5" />
                    {stateCount} states
                  </div>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                  {step.number}
                </span>
                <p className="truncate text-xs text-muted-foreground">
                  {getStepLabel(step)}
                </p>
              </div>
            </div>
          )})}
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

      {isLightboxOpen && (
        <FlowLightbox
          flow={flow}
          appSlug={appSlug}
          initialIndex={initialStep}
          onClose={closeLightbox}
          stateIndex={stateIndex}
        />
      )}
    </div>
  )
}
