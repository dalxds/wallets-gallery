// Browser-only copy/download helpers shared by every image action (the grid/flow
// hover buttons in image-actions.tsx and the viewer footers). Centralized so the
// fetch→blob→clipboard and fetch→objectURL→download dances live in one place and
// can't drift — e.g. the res.ok guard below (skip a missing screenshot instead of
// copying/saving a 404 HTML body) applies everywhere.

// Copy the ORIGINAL image bytes to the clipboard; on any failure (no clipboard
// image support, a missing screenshot) fall back to copying its absolute URL.
export async function copyImageToClipboard(src: string): Promise<void> {
  try {
    const res = await fetch(src)
    if (!res.ok) throw new Error(`fetch ${src}: ${res.status}`)
    const blob = await res.blob()
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
  } catch {
    await navigator.clipboard.writeText(
      new URL(src, window.location.href).toString()
    )
  }
}

// Copy a link, resolving a relative href against the current URL so callers can
// pass the share path directly (e.g. screenShareHref).
export async function copyLink(href: string): Promise<void> {
  await navigator.clipboard.writeText(
    new URL(href, window.location.href).toString()
  )
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
  URL.revokeObjectURL(url)
  return true
}
