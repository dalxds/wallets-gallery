"use client"

import type { FlowDetail, FlowStep } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { captureUrl } from "@/lib/images"
import { useCallback, useEffect, useRef, useState } from "react"
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
  flow: FlowDetail
  appSlug: string
  date: string
  flowDir: string
  onClose: () => void
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
  date,
  flowDir,
  onClose,
}: FlowLightboxProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [flowLinkCopied, setFlowLinkCopied] = useState(false)

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
    return captureUrl(appSlug, date, `${flowDir}/${step.screenshotPath}`)
  }

  async function copyFlowLink() {
    const url = `${window.location.origin}/apps/${appSlug}/flows/${flow.slug}`
    await navigator.clipboard.writeText(url)
    setFlowLinkCopied(true)
    setTimeout(() => setFlowLinkCopied(false), 1500)
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent
        className="flex h-[96vh] max-w-[97vw] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{flow.name}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {flow.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {flow.steps.length} steps
              </span>
            </p>
            <p className="text-sm text-muted-foreground">{flow.summary}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={copyFlowLink}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            >
              {flowLinkCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Link2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Flow strip — all steps side-by-side equally */}
        <div className="relative flex flex-1 items-center overflow-hidden bg-muted/30">
          {canScrollLeft && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 z-10 h-9 w-9 rounded-full shadow-md"
              onClick={() => scroll("left")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            ref={scrollRef}
            className="flex h-full items-center gap-4 overflow-x-auto px-14 py-4 scrollbar-hide"
            onScroll={updateScrollState}
          >
            {flow.steps.map((step) => (
              <StepCard
                key={step.number}
                step={step}
                src={stepSrc(step)}
                appSlug={appSlug}
                flowSlug={flow.slug}
              />
            ))}
          </div>

          {canScrollRight && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 z-10 h-9 w-9 rounded-full shadow-md"
              onClick={() => scroll("right")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StepCard({
  step,
  src,
  appSlug,
  flowSlug,
}: {
  step: FlowStep
  src: string
  appSlug: string
  flowSlug: string
}) {
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  async function copyImage(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
    } catch {
      await navigator.clipboard.writeText(window.location.origin + src)
    }
    setCopiedImage(true)
    setTimeout(() => setCopiedImage(false), 1500)
  }

  async function copyLink(e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(
      `${window.location.origin}/apps/${appSlug}/flows/${flowSlug}`
    )
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
  }

  async function downloadImage(e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch(src)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${appSlug}-${flowSlug}-step-${step.number}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="group/card flex shrink-0 flex-col items-center gap-2">
      <div className="relative">
        <img
          src={src}
          alt={step.description}
          className="max-h-[calc(96vh-9rem)] rounded-lg object-contain shadow-lg"
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
      </div>
      <div className="flex items-center gap-1.5 text-center">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
          {step.number}
        </span>
        <span className="max-w-32 truncate text-xs text-muted-foreground">
          {getStepLabel(step)}
        </span>
      </div>
    </div>
  )
}
