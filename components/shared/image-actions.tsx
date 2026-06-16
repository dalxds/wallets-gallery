"use client"

import { useState } from "react"
import { Copy, Check, Link2, Download } from "lucide-react"

interface ImageActionsProps {
  src: string
  /** Link to copy for "copy link" — may be relative; resolved against the current URL. */
  shareHref: string
}

export function ImageActions({ src, shareHref }: ImageActionsProps) {
  const [copiedImage, setCopiedImage] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  async function copyImage(e: React.MouseEvent) {
    e.preventDefault()
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
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(
      new URL(shareHref, window.location.href).toString()
    )
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 1500)
  }

  async function downloadImage(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const res = await fetch(src)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = src.split("/").pop() ?? "screenshot.png"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
      <button
        type="button"
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
