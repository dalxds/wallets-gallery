"use client"

import type { FlowEntry, ScreenEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { captureUrl, SCREENSHOT_HEIGHT, SCREENSHOT_WIDTH } from "@/lib/images"
import { screenHref } from "@/lib/links"
import { useCallback, useEffect, useMemo, useState } from "react"
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
import Image from "next/image"

interface ScreenLightboxProps {
  screens: ScreenEntry[]
  flows: FlowEntry[]
  activeScreenId: string
  appSlug: string
  date: string
  latest: string
  // Close the modal (the route owner wires this to router.back()).
  onClose: () => void
  // Reflect the active screen onto the URL on prev/next (router.replace).
  onNavigate: (screenId: string) => void
  // Jump to a flow at a given 0-based step (router.push to the flow route).
  onOpenFlow: (flowSlug: string, step: number) => void
}

// Cap the "Found in" chips so a screen that anchors many flows doesn't overflow
// the footer; the rest collapse into a "+N" count.
const MAX_FOUND_IN_CHIPS = 4

export function ScreenLightbox({
  screens,
  flows,
  activeScreenId,
  appSlug,
  date,
  latest,
  onClose,
  onNavigate,
  onOpenFlow,
}: ScreenLightboxProps) {
  // Internal index is the source of truth so paging is instant; onNavigate keeps
  // the URL in sync (router.replace) without re-seeding from the route param.
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(
      0,
      screens.findIndex((s) => s.id === activeScreenId)
    )
  )
  const [imageCopied, setImageCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const current = screens[currentIndex]
  const currentSrc = current ? captureUrl(appSlug, current.screenshotPath) : ""

  const flowNameBySlug = useMemo(
    () => new Map(flows.map((f) => [f.slug, f.name])),
    [flows]
  )

  // Distinct flows this screen appears in (deduped — an entry screen can recur
  // across a flow's steps), each linking to the step where it shows up.
  const foundIn = useMemo(() => {
    if (!current) return []
    const seen = new Set<string>()
    const out: { slug: string; name: string; step: number }[] = []
    for (const a of current.appearsIn ?? []) {
      if (seen.has(a.flow)) continue
      seen.add(a.flow)
      out.push({
        slug: a.flow,
        name: flowNameBySlug.get(a.flow) ?? a.flow,
        step: a.step,
      })
    }
    return out
  }, [current, flowNameBySlug])

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(screens.length - 1, index))
      if (clamped === currentIndex) return
      setCurrentIndex(clamped)
      onNavigate(screens[clamped].id)
    },
    [screens, currentIndex, onNavigate]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(currentIndex - 1)
      if (e.key === "ArrowRight") goTo(currentIndex + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goTo, currentIndex])

  async function copyImage() {
    if (!current) return
    try {
      // The original PNG, not the optimized /_next/image variant.
      const res = await fetch(currentSrc)
      if (!res.ok) throw new Error(`fetch ${currentSrc}: ${res.status}`)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch {
      await navigator.clipboard.writeText(window.location.origin + currentSrc)
    }
    setImageCopied(true)
    setTimeout(() => setImageCopied(false), 1500)
  }

  async function copyLink() {
    if (!current) return
    const url = `${window.location.origin}${screenHref(appSlug, current.id, date, latest)}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  async function downloadImage() {
    if (!current) return
    const res = await fetch(currentSrc)
    if (!res.ok) return // missing screenshot — don't download a broken/HTML file
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${appSlug}-${current.id}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  const atStart = currentIndex <= 0
  const atEnd = currentIndex >= screens.length - 1

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent
        className="flex h-[95vh] max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {current?.title ?? "Screen"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Screen lightbox viewer
        </DialogDescription>

        {/* Header: title + description, position, close */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{current?.title ?? ""}</p>
            {current?.description && (
              <p className="truncate text-sm text-muted-foreground">
                {current.description}
              </p>
            )}
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

        {/* Stage: the screenshot, flanked by prev/next arrows */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/30 px-16 py-6">
          <button
            type="button"
            aria-label="Previous screen"
            onClick={() => goTo(currentIndex - 1)}
            disabled={atStart}
            className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {current && (
            <Image
              key={current.id}
              src={currentSrc}
              alt={current.description || current.title}
              width={SCREENSHOT_WIDTH}
              height={SCREENSHOT_HEIGHT}
              sizes="(min-width: 768px) 40vw, 90vw"
              className="h-auto max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          )}

          <button
            type="button"
            aria-label="Next screen"
            onClick={() => goTo(currentIndex + 1)}
            disabled={atEnd}
            className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Footer: found-in flows · actions · platform */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {foundIn.length > 0 && (
              <span className="text-xs text-muted-foreground">Found in</span>
            )}
            {foundIn.slice(0, MAX_FOUND_IN_CHIPS).map((f) => (
              <button
                type="button"
                key={f.slug}
                onClick={() => onOpenFlow(f.slug, Math.max(0, f.step - 1))}
                className="max-w-40 truncate rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                title={f.name}
              >
                {f.name}
              </button>
            ))}
            {foundIn.length > MAX_FOUND_IN_CHIPS && (
              <span className="text-xs text-muted-foreground">
                +{foundIn.length - MAX_FOUND_IN_CHIPS}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={copyImage} className="gap-1.5">
              {imageCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy
            </Button>
            <Button variant="secondary" size="sm" onClick={copyLink} className="gap-1.5">
              {linkCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Link
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadImage} className="gap-1.5">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>

          <div className="flex items-center justify-end">
            <span className="text-xs tabular-nums text-muted-foreground">
              {currentIndex + 1} / {screens.length}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
