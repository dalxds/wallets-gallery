import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { formatDate } from "@/lib/utils"
import { GalleryFrame } from "@/components/app-detail/gallery-frame"

// A capture's gallery chrome (every capture is canonical at its dated URL). This
// layout renders the persisted chrome + metadata across the Screens↔Flows tab
// switch; the prerender config lives on the pages.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}): Promise<Metadata> {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) return {}
  const { app } = cap
  const title = `wallets.gallery - ${app.name}`
  const description = `${app.name} on ${formatDate(cap.view.captureDate)}`
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
