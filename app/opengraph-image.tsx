import { siteOgImage, ogSize, ogContentType } from "@/lib/og"

export const runtime = "nodejs"
export const size = ogSize
export const contentType = ogContentType
export const alt =
  "wallets.gallery — a showcase of money apps curated by agents"

export default function Image() {
  return siteOgImage()
}
