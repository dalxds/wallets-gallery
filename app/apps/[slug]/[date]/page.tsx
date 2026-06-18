import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { readRegistry, resolveCapture } from "@/lib/captures"
import { AppDetail } from "../app-detail"
import { appHref } from "@/lib/links"

// A historical capture's gallery. The latest lives at the clean /apps/[slug];
// every non-latest date gets its own prerendered page here.
export const dynamicParams = false

export function generateStaticParams() {
  const out: { slug: string; date: string }[] = []
  for (const app of readRegistry().apps)
    for (const date of app.captures)
      if (date !== app.latest) out.push({ slug: app.slug, date })
  return out
}

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

export default async function AppDatePage({
  params,
}: {
  params: Promise<{ slug: string; date: string }>
}) {
  const { slug, date } = await params
  const cap = resolveCapture(slug, date)
  if (!cap) notFound()
  // The latest capture's canonical home is the clean /apps/[slug]; send the dated
  // form there so it isn't a duplicate URL.
  if (cap.date === cap.latest) redirect(appHref(slug))
  return (
    <AppDetail slug={slug} view={cap.view} appIndex={cap.app} date={cap.date} />
  )
}
