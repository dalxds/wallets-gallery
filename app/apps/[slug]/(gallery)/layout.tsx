import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { resolveCapture } from "@/lib/captures"
import { GalleryFrame } from "@/components/app-detail/gallery-frame"

// The latest capture's gallery chrome. Wraps both tab pages — the Screens page
// (this group's page.tsx → /apps/[slug]) and the Flows page (flows/page.tsx →
// /apps/[slug]/flows) — so the chrome persists across the tab switch. The
// standalone screen/flow pages live OUTSIDE this group, so they don't inherit
// this chrome (they render their own header). Prerender config (dynamicParams +
// generateStaticParams) lives on the pages.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cap = resolveCapture(slug)
  if (!cap) return {}
  const { app } = cap
  const title = `${app.name} — Wallets Gallery`
  const description = `Captured ${app.platform.toUpperCase()} UI — ${app.screens} screens and ${app.flows} flows for ${app.name}.`
  return { title, description, openGraph: { title, description } }
}

export default async function GalleryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cap = resolveCapture(slug)
  if (!cap) notFound()
  return <GalleryFrame cap={cap}>{children}</GalleryFrame>
}
