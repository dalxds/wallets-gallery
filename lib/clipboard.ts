// Browser-only copy/download helpers shared by every image action (the grid/flow
// hover buttons in image-actions.tsx and the viewer footers). Centralized so the
// fetch→blob→clipboard and fetch→objectURL→download dances live in one place and
// can't drift — e.g. the res.ok guard below (skip a missing screenshot instead of
// copying/saving a 404 HTML body) applies everywhere.

// What copyImageToClipboard actually put on the clipboard, so callers can report the
// truth: "image" (the bytes), "url" (the fallback text), or "none" (nothing — don't
// flash success). Never rejects.
export type CopyImageResult = "image" | "url" | "none"

// Copy the ORIGINAL image bytes to the clipboard; on any failure (no clipboard image
// support, a missing screenshot) fall back to copying its absolute URL.
export async function copyImageToClipboard(src: string): Promise<CopyImageResult> {
  // Pass a PROMISE into ClipboardItem so navigator.clipboard.write is called synchronously
  // inside the user gesture. Awaiting the fetch/blob FIRST drops WebKit's transient user
  // activation and Safari rejects — the earlier code did exactly that. Promise-valued
  // ClipboardItem is supported by Safari 13.1+, Chrome 106+, Firefox 116+. Screenshots are
  // PNG per the data contract (and Safari only accepts PNG for images), so "image/png" is safe.
  if (typeof ClipboardItem !== "undefined") {
    try {
      const item = new ClipboardItem({
        "image/png": fetch(src).then(async (res) => {
          if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`)
          return await res.blob()
        }),
      })
      await navigator.clipboard.write([item])
      return "image"
    } catch {
      // fall through to the URL fallback
    }
  }
  try {
    await navigator.clipboard.writeText(new URL(src, window.location.href).toString())
    return "url"
  } catch {
    return "none"
  }
}

// Copy a link, resolving a relative href against the current URL so callers can
// pass the share path directly (e.g. screenHref).
export async function copyLink(href: string): Promise<void> {
  await navigator.clipboard.writeText(
    new URL(href, window.location.href).toString()
  )
}

// Download filenames — one place so every surface (viewers + grid/row hover buttons) names
// files the same way and can't drift. A screen saves as `<app>-<screenId>.png`; a flow step
// as `<app>-<flowSlug>-step-<n>[-<state>].png`. NOT the content-address src basename, which
// gives a folder of indistinguishable hash names.
export function screenDownloadName(appSlug: string, screenId: string): string {
  return `${appSlug}-${screenId}.png`
}
export function stepDownloadName(appSlug: string, flowSlug: string, stepNumber: number, stateSuffix = ""): string {
  return `${appSlug}-${flowSlug}-step-${stepNumber}${stateSuffix}.png`
}

// Download the image under `filename`. Returns false (without downloading) when
// the source is missing, so callers don't save a broken/HTML file.
export async function downloadImage(
  src: string,
  filename: string
): Promise<boolean> {
  const res = await fetch(src)
  if (!res.ok) return false
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  // Defer the revoke — revoking synchronously after click() races the download start, and
  // Safari can abort it or save zero bytes. 1s is comfortably past the click task.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
