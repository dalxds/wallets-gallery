"use client"

import type { FlowEntry, FlowStep, ScreenEntry } from "@/lib/types"
import { stateMeta, type StateIndex } from "@/lib/states"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { captureUrl } from "@/lib/images"
import { flowHref } from "@/lib/links"
import { cn } from "@/lib/utils"
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import {
  Copy,
  Check,
  Link2,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface FlowLightboxProps {
  flow: FlowEntry
  appSlug: string
  initialIndex?: number
  onClose: () => void
  stateIndex: StateIndex
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

export function FlowLightbox({
  flow,
  appSlug,
  initialIndex = 0,
  onClose,
  stateIndex,
}: FlowLightboxProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [flowLinkCopied, setFlowLinkCopied] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [ready, setReady] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
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
      scrollToIndex()
      requestAnimationFrame(() => {
        setReady(true)
      })
    })
    return () => cancelAnimationFrame(raf1)
  }, [scrollToIndex])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      if (ready) updateScrollState()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [updateScrollState, ready])

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.6
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

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
  }, [])

  function stepSrc(step: FlowStep) {
    return captureUrl(appSlug, step.screenshotPath)
  }

  async function copyFlowLink() {
    const url = `${window.location.origin}${flowHref(appSlug, flow.slug, initialIndex)}`
    await navigator.clipboard.writeText(url)
    setFlowLinkCopied(true)
    setTimeout(() => setFlowLinkCopied(false), 1500)
  }

  // Download every step's screenshot in order. Sequential (with a tiny gap) so
  // the browser doesn't drop a burst of simultaneous downloads; missing shots
  // (404 → HTML) are skipped rather than saved as broken files.
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
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        className="flex h-[80vh] max-w-[80vw] sm:max-w-[80vw] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{flow.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Flow lightbox viewer
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{flow.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {flow.steps.length}{" "}
              {flow.steps.length === 1 ? "screen" : "screens"}
              {flow.summary ? ` · ${flow.summary}` : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Flow strip */}
        <div className="relative flex flex-1 items-center overflow-hidden bg-muted/30">
          <button
            className={cn(
              "absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/90 text-neutral-900 shadow-lg backdrop-blur-sm transition-opacity hover:bg-white dark:bg-white/20 dark:text-white dark:hover:bg-white/30",
              canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            onClick={() => scroll("left")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div
            ref={scrollRef}
            className={cn(
              "flex h-full items-center gap-4 overflow-x-auto px-14 py-4 scrollbar-hide transition-opacity duration-150",
              ready ? "opacity-100" : "opacity-0"
            )}
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
                variants={stateIndex.variantsForScreen(step.screenId)}
              />
            ))}
          </div>

          <button
            className={cn(
              "absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/90 text-neutral-900 shadow-lg backdrop-blur-sm transition-opacity hover:bg-white dark:bg-white/20 dark:text-white dark:hover:bg-white/30",
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
            onClick={downloadAll}
            disabled={downloadingAll}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            {downloadingAll ? "Downloading…" : "Download all"}
          </Button>
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
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const StepCard = forwardRef<
  HTMLDivElement,
  {
    step: FlowStep
    src: string
    appSlug: string
    flowSlug: string
    variants: ScreenEntry[]
  }
>(function StepCard({ step, src, appSlug, flowSlug, variants }, ref) {
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
      // A 404 (e.g. a shot-less screen → empty path → directory URL) returns an HTML
      // page; guard so we don't write that HTML to the clipboard as an "image".
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
    // Deep-link to THIS step (step param is the 0-based index; step.number is 1-based),
    // matching the grid's per-step link — not the flow's first step.
    await navigator.clipboard.writeText(
      `${window.location.origin}${flowHref(appSlug, flowSlug, step.number - 1)}`
    )
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
  }

  async function downloadImage(e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch(displaySrc)
    if (!res.ok) return // missing screenshot — don't download a broken/HTML file
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
    <div ref={ref} className="group/card flex shrink-0 flex-col items-center gap-2">
      <div className="relative aspect-[1080/2400] h-[calc(80vh-12.5rem)] overflow-hidden rounded-lg bg-muted shadow-lg">
        <img
          src={displaySrc}
          alt={activeVariant?.description ?? step.title}
          className="h-full w-full object-contain"
        />
        {/* Hover action buttons */}
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
          <button
            onClick={copyImage}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            {copiedImage ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={copyLink}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            {copiedLink ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={downloadImage}
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
      </div>
      <div className="flex w-full items-start justify-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
          {step.number}
        </span>
        <span className="text-center text-xs text-muted-foreground">
          {getStepLabel(step)}
        </span>
      </div>
    </div>
  )
})
