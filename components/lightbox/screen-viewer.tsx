"use client"

import type { FlowEntry, ScreenEntry } from "@/lib/types"
import { captureUrl } from "@/lib/images"
import { screenHref, screenShareHref, flowHref } from "@/lib/links"
import { LightboxImage } from "./lightbox-image"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Copy,
  Check,
  Link2,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface ScreenViewerProps {
  screens: ScreenEntry[]
  flows: FlowEntry[]
  initialScreenId: string
  appSlug: string
  date: string
  latest: string
}

// Cap the "Found in" chips so a screen anchoring many flows doesn't overflow.
const MAX_FOUND_IN_CHIPS = 4

// The shared screen body used by BOTH the modal (inside a Dialog) and the
// full-screen page. Paging is internal index + window.history.replaceState — NO
// router navigation, so the host doesn't re-render or flicker; the image swaps
// from the in-memory list (with a skeleton during load). Only the surrounding
// chrome differs between modal and page.
export function ScreenViewer({
  screens,
  flows,
  initialScreenId,
  appSlug,
  date,
  latest,
}: ScreenViewerProps) {
  const router = useRouter()
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      screens.findIndex((s) => s.id === initialScreenId)
    )
  )
  const [imageCopied, setImageCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const current = screens[index]
  const currentSrc = current ? captureUrl(appSlug, current.screenshotPath) : ""

  const flowNameBySlug = useMemo(
    () => new Map(flows.map((f) => [f.slug, f.name])),
    [flows]
  )

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
    (i: number) => {
      const clamped = Math.max(0, Math.min(screens.length - 1, i))
      if (clamped === index) return
      setIndex(clamped)
      // Reflect the active screen onto the URL WITHOUT a router navigation, so the
      // modal/page never re-renders (no flicker). Preserve Next's history state so
      // back() still works (closes the modal / returns where you came from).
      window.history.replaceState(
        window.history.state,
        "",
        screenHref(appSlug, screens[clamped].id, date, latest)
      )
    },
    [screens, index, appSlug, date, latest]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(index - 1)
      if (e.key === "ArrowRight") goTo(index + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goTo, index])

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
    // Dated link so it stays valid after a newer capture lands.
    const url = `${window.location.origin}${screenShareHref(appSlug, current.id, date)}`
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

  const atStart = index <= 0
  const atEnd = index >= screens.length - 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Caption: screen title + description */}
      <div className="border-b px-4 py-2.5">
        <p className="truncate font-medium">{current?.title ?? ""}</p>
        {current?.description && (
          <p className="truncate text-sm text-muted-foreground">
            {current.description}
          </p>
        )}
      </div>

      {/* Stage: the screenshot, flanked by prev/next arrows */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/30 px-16 py-6">
        <button
          type="button"
          aria-label="Previous screen"
          onClick={() => goTo(index - 1)}
          disabled={atStart}
          className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {current && (
          <LightboxImage
            src={currentSrc}
            alt={current.description || current.title}
            sizes="(min-width: 768px) 40vw, 90vw"
            className="aspect-[1080/2400] h-full max-w-full rounded-2xl shadow-2xl"
          />
        )}

        <button
          type="button"
          aria-label="Next screen"
          onClick={() => goTo(index + 1)}
          disabled={atEnd}
          className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Footer: found-in flows · actions · counter */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {foundIn.length > 0 && (
            <span className="text-xs text-muted-foreground">Found in</span>
          )}
          {foundIn.slice(0, MAX_FOUND_IN_CHIPS).map((f) => (
            <button
              type="button"
              key={f.slug}
              onClick={() =>
                router.push(
                  flowHref(appSlug, f.slug, date, latest, Math.max(0, f.step - 1))
                )
              }
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
            {index + 1} / {screens.length}
          </span>
        </div>
      </div>
    </div>
  )
}
