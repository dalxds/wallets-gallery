import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { GalleryFrame } from "@/components/app-detail/gallery-frame"

// A historical capture's gallery chrome — mirrors the latest one a level down so
// dated captures get the same persisted chrome across the tab switch. The
// latest→clean redirect lives on the pages (its target differs per tab), so this
// layout only renders chrome + metadata. Prerender config is on the pages.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}): Promise<Metadata> {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) return {}
  const { app } = cap
  const title = `${app.name} (${date}) — Wallets Gallery`
  const description = `Captured ${app.platform.toUpperCase()} UI for ${app.name} — ${date} capture.`
  return { title, description, openGraph: { title, description } }
}

export default async function DatedGalleryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  return <GalleryFrame cap={cap}>{children}</GalleryFrame>
}
