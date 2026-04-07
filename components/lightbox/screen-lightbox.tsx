"use client"

import type { ScreenEntry } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { captureUrl } from "@/lib/images"
import { cn, formatScreenId } from "@/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"
import { Copy, Check, Link2, Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryState } from "nuqs"

interface ScreenLightboxProps {
  screens: ScreenEntry[]
  activeScreenId: string
  appSlug: string
  date: string
}

export function ScreenLightbox({
  screens,
  activeScreenId,
  appSlug,
  date,
}: ScreenLightboxProps) {
  const [, setScreen] = useQueryState("screen")
  const [currentIndex, setCurrentIndex] = useState(() =>
    screens.findIndex((s) => s.id === activeScreenId)
  )
  const [imageCopied, setImageCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  const current = screens[currentIndex]
  const currentSrc = current
    ? captureUrl(appSlug, date, current.screenshotPath)
    : ""

  const scrollThumbIntoView = useCallback((index: number) => {
    const strip = stripRef.current
    if (!strip) return
    const thumb = strip.children[index] as HTMLElement
    if (!thumb) return
    thumb.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [])

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(screens.length - 1, index))
      setCurrentIndex(clamped)
      setScreen(screens[clamped].id)
      scrollThumbIntoView(clamped)
    },
    [screens, setScreen, scrollThumbIntoView]
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
      const res = await fetch(currentSrc)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
    } catch {
      // fallback
    }
    setImageCopied(true)
    setTimeout(() => setImageCopied(false), 1500)
  }

  async function copyLink() {
    const url = `${window.location.origin}/apps/${appSlug}/screens/${current?.id}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 1500)
  }

  async function downloadImage() {
    if (!current) return
    const res = await fetch(currentSrc)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${appSlug}-${current.id}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  function close() {
    setScreen(null)
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent
        className="flex h-[95vh] max-w-[95vw] sm:max-w-[95vw] flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {current?.description ?? "Screen"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Screen lightbox viewer
        </DialogDescription>

        {/* Header with title + close */}
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {current ? formatScreenId(current.id) : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {current?.description}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={close}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main image */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-muted/30 p-4">
          {current && (
            <img
              src={currentSrc}
              alt={current.description}
              className="max-h-[calc(100%-3rem)] rounded-lg object-contain shadow-lg"
            />
          )}
          {/* Icon-only action buttons centered below image */}
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={copyImage}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            >
              {imageCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={copyLink}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Link2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={downloadImage}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Bottom bar: thumbnails */}
        <div className="border-t bg-background">
          <div className="flex gap-2 overflow-x-auto p-2" ref={stripRef}>
            {screens.map((screen, i) => (
              <button
                key={screen.id}
                onClick={() => goTo(i)}
                className={cn(
                  "w-12 shrink-0 overflow-hidden rounded border transition-all sm:w-16",
                  i === currentIndex
                    ? "ring-2 ring-primary"
                    : "opacity-50 hover:opacity-80"
                )}
              >
                <img
                  src={captureUrl(appSlug, date, screen.screenshotPath)}
                  alt={screen.id}
                  className="h-auto w-full"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
