"use client"

import type { ClientFlow, ClientScreen } from "@/lib/types"
import { captureUrl } from "@/lib/images"
import {
  copyImageToClipboard,
  copyLink,
  downloadImage,
  screenDownloadName,
} from "@/lib/clipboard"
import { useCopyFeedback } from "@/lib/use-copy-feedback"
import { screenHref, flowHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import { LightboxImage } from "./lightbox-image"
import { LightboxHeader } from "./lightbox-header"
import Image from "next/image"
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
  screens: ClientScreen[]
  flows: ClientFlow[]
  initialScreenId: string
  appSlug: string
  /** App name shown in the header breadcrumb. */
  appName: string
  /** App logo path (AppIndex.logo) or null → generated avatar. */
  appLogo: string | null
  /** Where the header's logo/name links — this capture's gallery (captureBase). */
  backHref: string
  date: string
  /** Set by the modal: renders a trailing close (X) in the header. */
  onClose?: () => void
  /**
   * Mark the first-shown screenshot as the LCP (high priority, not lazy). Set by
   * the standalone page — where the image is the page's largest paint — and left
   * off in the modal, which opens after the gallery has already painted.
   */
  priorityInitial?: boolean
}

// Cap the "Found in" chips so a screen anchoring many flows doesn't overflow.
const MAX_FOUND_IN_CHIPS = 4

// The displayed size of the stage image; shared by the visible image and the
// neighbour preloaders so all three request the SAME optimized variant (the
// preloaded neighbour is then a cache hit when you page to it).
const STAGE_SIZES = "(min-width: 768px) 40vw, 90vw"

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
  appName,
  appLogo,
  backHref,
  date,
  onClose,
  priorityInitial = false,
}: ScreenViewerProps) {
  const router = useRouter()
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      screens.findIndex((s) => s.id === initialScreenId)
    )
  )
  // "image"/"url" reflect what actually reached the clipboard (Safari can only get the URL
  // fallback), so the label never claims the image was copied when it wasn't. null = idle.
  const [imageCopied, flashImageCopied] = useCopyFeedback<"image" | "url">()
  const [linkCopied, flashLinkCopied] = useCopyFeedback<true>()
  // Once the user pages, the shown image is no longer the LCP — drop the priority
  // hint so later swaps don't each inject a preload.
  const [paged, setPaged] = useState(false)

  const current = screens[index]
  const currentSrc = current ? captureUrl(appSlug, current.screenshotPath) : ""

  // The two adjacent screenshots, prefetched (eager, hidden) so prev/next is a
  // cache hit instead of a fresh download — without eagerly fetching the rest.
  const neighborSrcs = useMemo(() => {
    const out: string[] = []
    for (const i of [index - 1, index + 1]) {
      const s = screens[i]
      if (s) out.push(captureUrl(appSlug, s.screenshotPath))
    }
    return out
  }, [screens, index, appSlug])

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
      setPaged(true)
      // Reflect the active screen onto the URL WITHOUT a router navigation, so the
      // modal/page never re-renders (no flicker). Preserve Next's history state so
      // back() still works (closes the modal / returns where you came from). The
      // URL is always dated, so paging stays on this capture.
      window.history.replaceState(
        window.history.state,
        "",
        screenHref(appSlug, screens[clamped].id, date)
      )
    },
    [screens, index, appSlug, date]
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
    // The original PNG, not the optimized /_next/image variant.
    const result = await copyImageToClipboard(currentSrc)
    if (result === "none") return // copy failed — no false success
    flashImageCopied(result)
  }

  async function handleCopyLink() {
    if (!current) return
    // Dated link so it stays valid after a newer capture lands.
    await copyLink(screenHref(appSlug, current.id, date))
    flashLinkCopied(true)
  }

  async function handleDownload() {
    if (!current) return
    await downloadImage(currentSrc, screenDownloadName(appSlug, current.id))
  }

  const atStart = index <= 0
  const atEnd = index >= screens.length - 1

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: app logo + name · screen title (+ close in the modal) */}
      <LightboxHeader
        appSlug={appSlug}
        appName={appName}
        appLogo={appLogo}
        backHref={backHref}
        title={current?.title ?? ""}
        onClose={onClose}
      />

      {/* Stage: the screenshot, flanked by prev/next arrows */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/30 px-16 py-6">
        <button
          type="button"
          aria-label="Previous screen"
          onClick={() => goTo(index - 1)}
          disabled={atStart}
          className="absolute top-1/2 left-4 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {current && (
          <LightboxImage
            src={currentSrc}
            alt={current.description || current.title}
            sizes={STAGE_SIZES}
            preload={priorityInitial && !paged}
            className="aspect-[1080/2400] h-full max-w-full rounded-2xl shadow-2xl"
          />
        )}

        {/* Prefetch the neighbours (hidden, eager) so prev/next is instant. Same
            sizes as the stage → the variant is already cached on navigation. */}
        {neighborSrcs.map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            fill
            sizes={STAGE_SIZES}
            loading="eager"
            aria-hidden
            className="invisible"
          />
        ))}

        <button
          type="button"
          aria-label="Next screen"
          onClick={() => goTo(index + 1)}
          disabled={atEnd}
          className="absolute top-1/2 right-4 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-0"
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
                  flowHref(
                    appSlug,
                    f.slug,
                    date,
                    f.step,
                    current?.stateGroup
                      ? (current.state ?? "default")
                      : undefined
                  )
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
          <Button
            variant="secondary"
            size="sm"
            onClick={copyImage}
            className="gap-1.5"
          >
            {imageCopied === "image" ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : imageCopied === "url" ? (
              <Link2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {imageCopied === "image"
              ? "Copied"
              : imageCopied === "url"
                ? "Link copied"
                : "Copy"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5"
          >
            {linkCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Link
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <div className="flex items-center justify-end">
          <span className="text-xs text-muted-foreground">
            {formatDate(date)} ·{" "}
            <span className="tabular-nums">
              {index + 1} / {screens.length}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
