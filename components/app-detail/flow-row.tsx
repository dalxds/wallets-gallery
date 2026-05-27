"use client"

import type { FlowEntry } from "@/lib/types"
import { LazyImage } from "@/components/shared/lazy-image"
import { captureUrl } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Check, Link2 } from "lucide-react"
import { useRef, useState, useEffect, useCallback } from "react"
import { useQueryState } from "nuqs"
import { FlowLightbox } from "@/components/lightbox/flow-lightbox"
import { ImageActions } from "@/components/shared/image-actions"

interface FlowRowProps {
  flow: FlowEntry
  appSlug: string
}

export function FlowRow({ flow, appSlug }: FlowRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [flowParam, setFlowParam] = useQueryState("flow")
  const [stepParam, setStepParam] = useQueryState("step")

  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx)
    setFlowParam(flow.slug)
    setStepParam(String(idx))
  }, [flow.slug, setFlowParam, setStepParam])

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    setFlowParam(null)
    setStepParam(null)
  }, [setFlowParam, setStepParam])

  // Auto-open lightbox when URL flow param matches this flow (deep link)
  useEffect(() => {
    if (flowParam === flow.slug && lightboxIndex === null) {
      const idx = stepParam ? parseInt(stepParam, 10) : 0
      setLightboxIndex(isNaN(idx) ? 0 : idx)
    }
  }, [flowParam, flow.slug, stepParam, lightboxIndex])

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
    const url = `${window.location.origin}/apps/${appSlug}/flows/${flow.slug}`
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
            {flow.steps.length} steps
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
          {flow.steps.map((step, idx) => (
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
                  screenUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/apps/${appSlug}/flows/${flow.slug}`}
                />
                <LazyImage
                  src={captureUrl(appSlug, step.screenshotPath)}
                  alt={step.title}
                />
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
          ))}
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

      {lightboxIndex !== null && (
        <FlowLightbox
          flow={flow}
          appSlug={appSlug}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}
