import { siteOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt = "Wallets Gallery"

export default function Image() {
  return siteOgImage()
}
