"use client"

import type { ClientFlow, FlowStep, ClientScreen } from "@/lib/types"
import { stateMeta, buildStateIndex } from "@/lib/states"
import { captureUrl } from "@/lib/images"
import { copyImageToClipboard, copyLink, downloadImage, stepDownloadName } from "@/lib/clipboard"
import { useCopyFeedback } from "@/lib/use-copy-feedback"
import { flowHref, parseStepParam } from "@/lib/links"
import { LightboxImage } from "./lightbox-image"
import { LightboxHeader } from "./lightbox-header"
import { cn, formatDate } from "@/lib/utils"
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
  flow: ClientFlow
  screens: ClientScreen[]
  appSlug: string
  /** App name shown in the header breadcrumb. */
  appName: string
  /** App logo path (AppIndex.logo) or null → generated avatar. */
  appLogo: string | null
  /** Where the header's logo/name links — this capture's flows tab (flowsHref). */
  backHref: string
  date: string
  /** Set by the modal: renders a trailing close (X) in the header. */
  onClose?: () => void
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
  appName,
  appLogo,
  backHref,
  date,
  onClose,
}: FlowViewerProps) {
  // Built here (client) — the state index holds a closure, so it can't cross the
  // server→client boundary as a prop.
  const stateIndex = useMemo(() => buildStateIndex(screens), [screens])
  const scrollRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // The ?step deep-link is read HERE, on the client, not as a server prop — so the
  // standalone flow page never reads searchParams on the server and stays
  // cacheable (on-demand-then-cache, like the screen page) instead of needing
  // force-dynamic. Read once on mount; the strip is opacity-0 until centered, so
  // there's no visible jump. An out-of-range step lands on step 1 and the stale
  // ?step is stripped from the URL (see the mount effect below).
  const initialIndexRef = useRef(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  // Whether the whole strip fits without scrolling (a single-screen flow, or a
  // short one on a wide viewport). When it fits we center the cards; only when it
  // overflows do we left-align and let centerOnInitial scroll the active card into
  // the middle — so a one-screen flow looks just like a multi-screen one, not
  // pinned to the left edge.
  const [fits, setFits] = useState(false)
  const [flowLinkCopied, flashFlowLinkCopied] = useCopyFeedback<true>()
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
    setFits(el.scrollWidth <= el.clientWidth + 1)
  }, [])

  const measureHeight = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Two constraints on the step image height:
    //   • fit the strip: clientHeight − py-4 padding (32) − label/gap (≈28)
    //   • keep a card ≤ ~62% of the strip width so the neighbours always peek
    //     (one screen centered at a time on narrow/mobile). Card width =
    //     height·9/20, so height ≤ 0.62·width·20/9.
    const byHeight = el.clientHeight - 60
    const byWidth = (el.clientWidth * 0.62 * 20) / 9
    setStepImgH(Math.max(160, Math.min(byHeight, byWidth)))
  }, [])

  const centerOnInitial = useCallback(() => {
    const container = scrollRef.current
    const stepEl = stepRefs.current.get(initialIndexRef.current)
    if (stepEl && container) {
      container.scrollLeft =
        stepEl.offsetLeft - (container.clientWidth - stepEl.offsetWidth) / 2
    }
    updateScrollState()
  }, [updateScrollState])

  // Resolve the ?step deep-link on mount (client-only), before the strip is
  // measured and centered below.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("step")
    const { index, valid } = parseStepParam(raw ?? undefined, flow.steps.length)
    initialIndexRef.current = index
    if (!valid) {
      // Stale / out-of-range deep link: land on step 1 and heal the URL back to
      // the bare (dated) flow. Preserve Next's history state so back() still
      // closes the modal / returns where you came from.
      window.history.replaceState(
        window.history.state,
        "",
        flowHref(appSlug, flow.slug, date)
      )
    }
  }, [appSlug, flow.slug, flow.steps.length, date])

  // Measure the strip on mount so the cards get their final width.
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => measureHeight())
    return () => cancelAnimationFrame(raf1)
  }, [measureHeight])

  // Center the ?step card once the cards have their measured width (centering
  // against the fallback width would land off). Once only — later resizes must
  // not yank the user's scroll. The strip is opacity-0 until ready, so the jump
  // to position isn't visible.
  const didCenter = useRef(false)
  useEffect(() => {
    if (stepImgH == null || didCenter.current) return
    didCenter.current = true
    centerOnInitial()
    requestAnimationFrame(() => setReady(true))
  }, [stepImgH, centerOnInitial])

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
    // Dated link to the flow (no step → lands on step 1) so it stays valid
    // after a newer capture.
    await copyLink(flowHref(appSlug, flow.slug, date))
    flashFlowLinkCopied(true)
  }

  async function downloadAll() {
    setDownloadingAll(true)
    try {
      for (const step of flow.steps) {
        try {
          const ok = await downloadImage(
            stepSrc(step),
            stepDownloadName(appSlug, flow.slug, step.number)
          )
          // Throttle only between saved files; skip a missing/failed step.
          if (ok) await new Promise((r) => setTimeout(r, 150))
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
      {/* Header: app logo + name · flow name (+ close in the modal) */}
      <LightboxHeader
        appSlug={appSlug}
        appName={appName}
        appLogo={appLogo}
        backHref={backHref}
        title={flow.name}
        onClose={onClose}
      />

      {/* Flow strip */}
      <div className="relative flex min-h-0 flex-1 items-center overflow-hidden bg-muted/30">
        <button
          type="button"
          aria-label="Scroll left"
          className={cn(
            "absolute left-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition-opacity hover:bg-background md:flex",
            canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => scroll("left")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className={cn(
            // w-full so the strip always spans the stage; without it a strip whose
            // cards don't overflow shrinks to its content and sits at the left edge.
            "scrollbar-hide flex h-full w-full snap-x snap-mandatory items-center gap-4 overflow-x-auto px-6 py-4 transition-opacity duration-150 md:snap-none md:px-14",
            // Center when it fits; left-align only when it overflows (else the
            // first card is clipped out of reach on a scrollable strip).
            fits && "justify-center",
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
            "absolute right-3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border bg-background/90 text-foreground shadow-lg backdrop-blur transition-opacity hover:bg-background md:flex",
            canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => scroll("right")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom bar: screen count · actions · capture date */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t px-4 py-3">
        <div className="flex items-center">
          <span className="text-xs text-muted-foreground">
            {flow.steps.length} {flow.steps.length === 1 ? "screen" : "screens"}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5">
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

        <div className="flex items-center justify-end">
          <span className="text-xs text-muted-foreground">
            {formatDate(date)}
          </span>
        </div>
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
  variants: ClientScreen[]
  ref?: React.Ref<HTMLDivElement>
}) {
  // "image"/"url" reflect what actually reached the clipboard (Safari can only get the URL
  // fallback), so the flash never claims the image was copied when it wasn't. null = idle.
  const [copiedImage, flashImage] = useCopyFeedback<"image" | "url">()
  const [copiedLink, flashLink] = useCopyFeedback<true>()
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
    const result = await copyImageToClipboard(displaySrc)
    if (result === "none") return // copy failed — no false success
    flashImage(result)
  }

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation()
    // Dated deep-link to THIS step (?step is 1-based, matching step.number).
    await copyLink(flowHref(appSlug, flowSlug, date, step.number))
    flashLink(true)
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    const stateSuffix =
      activeVariant && activeVariant.id !== step.screenId
        ? `-${activeVariant.state}`
        : ""
    await downloadImage(
      displaySrc,
      stepDownloadName(appSlug, flowSlug, step.number, stateSuffix)
    )
  }

  return (
    <div
      ref={ref}
      className="group/card flex w-[calc(var(--step-h,60vh)*9/20)] shrink-0 snap-center flex-col items-center gap-2"
    >
      <LightboxImage
        src={displaySrc}
        alt={activeVariant?.description ?? step.title}
        // Track the same bound measureHeight uses: card width = min(0.62·stripW, (stripH−60)·9/20),
        // and the strip fills the modal (max-w-[80vw]/95vw, h-[80vh]/85vh). So an upper bound is
        // min(~50vw, ~40vh) on desktop / min(~60vw, ~40vh) on mobile — err slightly high, never low.
        // The old flat 300px made the browser fetch the 384px variant and stretch it on wide screens.
        sizes="(min-width: 768px) min(50vw, 40vh), min(60vw, 40vh)"
        className="aspect-[1080/2400] h-[var(--step-h,60vh)] rounded-lg shadow-lg"
      >
        {/* Hover action buttons */}
        <div className="pointer-events-none absolute top-1.5 right-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100">
          <button
            type="button"
            onClick={copyImage}
            aria-label={
              copiedImage === "image"
                ? "Image copied"
                : copiedImage === "url"
                  ? "Link copied (image copy unavailable)"
                  : "Copy image"
            }
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            {copiedImage === "image" ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : copiedImage === "url" ? (
              <Link2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
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
            onClick={handleDownload}
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
