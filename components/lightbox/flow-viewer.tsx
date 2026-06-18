"use client"

import type { FlowEntry, FlowStep, ScreenEntry } from "@/lib/types"
import { stateMeta, buildStateIndex } from "@/lib/states"
import { captureUrl } from "@/lib/images"
import { flowShareHref } from "@/lib/links"
import { LightboxImage } from "./lightbox-image"
import { cn } from "@/lib/utils"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  Copy,
  Check,
  Link2,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface FlowViewerProps {
  flow: FlowEntry
  screens: ScreenEntry[]
  appSlug: string
  date: string
  initialIndex?: number
}

function getStepLabel(step: FlowStep): string {
  if (
    step.action.toLowerCase() === "entry point" ||
    step.action.toLowerCase() === "entry"
  ) {
    return step.title
  }
  return step.action
}

// The shared flow body used by BOTH the modal (inside a Dialog) and the
// full-screen page: a horizontal step strip with state switchers and per-step
// actions, plus a bottom action bar. Only the surrounding chrome differs.
export function FlowViewer({
  flow,
  screens,
  appSlug,
  date,
  initialIndex = 0,
}: FlowViewerProps) {
  // Built here (client) — the state index holds a closure, so it can't cross the
  // server→client boundary as a prop.
  const stateIndex = useMemo(() => buildStateIndex(screens), [screens])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [flowLinkCopied, setFlowLinkCopied] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [ready, setReady] = useState(false)
  // Step image height in px, measured from the strip so cards fill the available
  // height with an aspect-derived width. A definite px height (not h-full %) is
  // required — otherwise aspect-ratio gives the card no width and the cards
  // collapse/overlap. Falls back to 60vh until measured.
  const [stepImgH, setStepImgH] = useState<number | null>(null)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  const measureHeight = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // strip clientHeight − py-4 padding (32) − label + gap (≈28)
    setStepImgH(Math.max(160, el.clientHeight - 60))
  }, [])

  const scrollToIndex = useCallback(() => {
    const container = scrollRef.current
    const stepEl = stepRefs.current.get(initialIndex)
    if (stepEl && container) {
      container.scrollLeft =
        stepEl.offsetLeft - (container.clientWidth - stepEl.offsetWidth) / 2
    }
    updateScrollState()
  }, [initialIndex, updateScrollState])

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      measureHeight()
      scrollToIndex()
      requestAnimationFrame(() => setReady(true))
    })
    return () => cancelAnimationFrame(raf1)
  }, [scrollToIndex, measureHeight])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      measureHeight()
      if (ready) updateScrollState()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [updateScrollState, measureHeight, ready])

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        scroll("left")
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        scroll("right")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [scroll])

  function stepSrc(step: FlowStep) {
    return captureUrl(appSlug, step.screenshotPath)
  }

  async function copyFlowLink() {
    // Dated link to the flow (step 0) so it stays valid after a newer capture.
    const url = `${window.location.origin}${flowShareHref(appSlug, flow.slug, date)}`
    await navigator.clipboard.writeText(url)
    setFlowLinkCopied(true)
    setTimeout(() => setFlowLinkCopied(false), 1500)
  }

  async function downloadAll() {
    setDownloadingAll(true)
    try {
      for (const step of flow.steps) {
        try {
          const res = await fetch(stepSrc(step))
          if (!res.ok) continue
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${appSlug}-${flow.slug}-step-${step.number}.png`
          a.click()
          URL.revokeObjectURL(url)
          await new Promise((r) => setTimeout(r, 150))
        } catch {
          // skip a single failed step; keep downloading the rest
        }
      }
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Caption: flow name + summary */}
      <div className="border-b px-4 py-2.5">
        <p className="truncate font-medium">{flow.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {flow.steps.length} {flow.steps.length === 1 ? "screen" : "screens"}
          {flow.summary ? ` · ${flow.summary}` : ""}
        </p>
      </div>

      {/* Flow strip */}
      <div className="relative flex min-h-0 flex-1 items-center overflow-hidden bg-muted/30">
        <button
          type="button"
          aria-label="Scroll left"
          className={cn(
            "absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition-opacity hover:bg-background",
            canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className={cn(
            "scrollbar-hide flex h-full items-center gap-4 overflow-x-auto px-14 py-4 transition-opacity duration-150",
            ready ? "opacity-100" : "opacity-0"
          )}
          style={
            {
              "--step-h": stepImgH != null ? `${stepImgH}px` : undefined,
            } as CSSProperties
          }
          onScroll={updateScrollState}
        >
          {flow.steps.map((step, idx) => (
            <StepCard
              key={step.number}
              ref={(el) => {
                if (el) stepRefs.current.set(idx, el)
                else stepRefs.current.delete(idx)
              }}
              step={step}
              src={stepSrc(step)}
              appSlug={appSlug}
              flowSlug={flow.slug}
              date={date}
              variants={stateIndex.variantsForScreen(step.screenId)}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Scroll right"
          className={cn(
            "absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition-opacity hover:bg-background",
            canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-center gap-1.5 border-t px-4 py-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={copyFlowLink}
          className="gap-1.5"
        >
          {flowLinkCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          Link
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={downloadAll}
          disabled={downloadingAll}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" />
          {downloadingAll ? "Downloading…" : "Download all"}
        </Button>
      </div>
    </div>
  )
}

function StepCard({
  step,
  src,
  appSlug,
  flowSlug,
  date,
  variants,
  ref,
}: {
  step: FlowStep
  src: string
  appSlug: string
  flowSlug: string
  date: string
  variants: ScreenEntry[]
  ref?: React.Ref<HTMLDivElement>
}) {
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [activeId, setActiveId] = useState(step.screenId)

  const hasStates = variants.length > 1
  const activeVariant = hasStates
    ? variants.find((v) => v.id === activeId)
    : undefined
  const displaySrc = activeVariant
    ? captureUrl(appSlug, activeVariant.screenshotPath)
    : src

  async function copyImage(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(displaySrc)
      if (!res.ok) throw new Error(`fetch ${displaySrc}: ${res.status}`)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
    } catch {
      await navigator.clipboard.writeText(window.location.origin + displaySrc)
    }
    setCopiedImage(true)
    setTimeout(() => setCopiedImage(false), 1500)
  }

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation()
    // Dated deep-link to THIS step (0-based; step.number is 1-based).
    await navigator.clipboard.writeText(
      `${window.location.origin}${flowShareHref(appSlug, flowSlug, date, step.number - 1)}`
    )
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
  }

  async function downloadImage(e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch(displaySrc)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const stateSuffix =
      activeVariant && activeVariant.id !== step.screenId
        ? `-${activeVariant.state}`
        : ""
    a.href = url
    a.download = `${appSlug}-${flowSlug}-step-${step.number}${stateSuffix}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      ref={ref}
      className="group/card flex w-[calc(var(--step-h,60vh)*9/20)] shrink-0 flex-col items-center gap-2"
    >
      <LightboxImage
        src={displaySrc}
        alt={activeVariant?.description ?? step.title}
        sizes="(min-width: 768px) 300px, 60vw"
        className="aspect-[1080/2400] h-[var(--step-h,60vh)] rounded-lg shadow-lg"
      >
        {/* Hover action buttons */}
        <div className="absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
          <button
            type="button"
            onClick={copyImage}
            aria-label="Copy image"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            {copiedImage ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={copyLink}
            aria-label="Copy link"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            {copiedLink ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={downloadImage}
            aria-label="Download image"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* State switcher — overlaid so the screenshot keeps its full height */}
        {hasStates && (
          <div
            className="absolute inset-x-0 bottom-3 z-10 flex justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-0.5 rounded-full border bg-background/90 p-0.5 shadow-md backdrop-blur">
              {variants.map((v) => {
                const meta = stateMeta(v.state ?? "default")
                const active = v.id === activeId
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setActiveId(v.id)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                      active &&
                        meta.tone === "warning" &&
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                      active &&
                        meta.tone === "neutral" &&
                        "bg-foreground text-background",
                      !active && "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </LightboxImage>

      <div className="flex w-full items-center justify-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
          {step.number}
        </span>
        <span className="min-w-0 truncate text-center text-xs text-muted-foreground">
          {getStepLabel(step)}
        </span>
      </div>
    </div>
  )
}
