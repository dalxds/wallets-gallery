export function captureUrl(slug: string, relativePath: string): string {
  return `/captures/${slug}/${relativePath}`
}

// Canonical phone-screenshot dimensions. Captures are portrait device shots
// (~1080×2400). Used as the intrinsic size for next/image where the full image
// renders at its natural aspect (lightbox stage, standalone hero); thumbnails use
// `fill` inside fixed aspect-ratio boxes and don't need these.
export const SCREENSHOT_WIDTH = 1080
export const SCREENSHOT_HEIGHT = 2400
