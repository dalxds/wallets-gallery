import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { readRegistry, resolveCapture } from "@/lib/captures"
import { AppDetail } from "./app-detail"

// The latest capture's gallery, at the clean /apps/[slug]. Historical captures
// live at /apps/[slug]/[date]. Both are prerendered (the slug/date set is fixed).
export const dynamicParams = false

export function generateStaticParams() {
  return readRegistry().apps.map((a) => ({ slug: a.slug }))
}

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

export default async function AppLatestPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cap = resolveCapture(slug)
  if (!cap) notFound()
  return (
    <AppDetail slug={slug} view={cap.view} appIndex={cap.app} date={cap.date} />
  )
}
