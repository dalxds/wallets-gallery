"use client"

import { Copy, Check, Link2, Download } from "lucide-react"
import {
  copyImageToClipboard,
  copyLink as copyLinkToClipboard,
  downloadImage as downloadImageFile,
} from "@/lib/clipboard"
import { useCopyFeedback } from "@/lib/use-copy-feedback"

interface ImageActionsProps {
  src: string
  /** Link to copy for "copy link" — may be relative; resolved against the current URL. */
  shareHref: string
  /** Filename for the download — built by the caller via screenDownloadName / stepDownloadName so
   *  the grid names files the same way the viewers do, not by the content-hash src basename. */
  downloadName: string
}

export function ImageActions({ src, shareHref, downloadName }: ImageActionsProps) {
  // "image"/"url" reflect what actually landed on the clipboard so the flash doesn't claim the
  // image was copied when Safari only got the URL fallback. null = idle.
  const [copiedImage, flashImage] = useCopyFeedback<"image" | "url">()
  const [copiedLink, flashLink] = useCopyFeedback<true>()

  async function copyImage(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const result = await copyImageToClipboard(src)
    if (result === "none") return // copy failed — no false success flash
    flashImage(result)
  }

  async function copyLink(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await copyLinkToClipboard(shareHref)
    flashLink(true)
  }

  async function downloadImage(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await downloadImageFile(src, downloadName)
  }

  return (
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
        title={copiedImage === "url" ? "Link copied (image copy unavailable)" : "Copy image"}
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
        type="button"
        onClick={downloadImage}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
