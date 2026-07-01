import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { resolveFlow } from "@/lib/captures"
import { formatDate } from "@/lib/utils"
import { FlowPage } from "@/components/standalone/flow-page"

// Standalone flow page for a capture. Nothing is prebuilt (generateStaticParams
// returns []); every flow renders on demand and then caches. The ?step deep-link
// is read on the CLIENT (in FlowViewer), not here — so this page never touches
// searchParams on the server and stays cacheable, exactly like the screen page.
export const dynamicParams = true
export const revalidate = false

export function generateStaticParams() {
  return [] as { slug: string; date: string; flowSlug: string }[]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}): Promise<Metadata> {
  const { slug, date, flowSlug } = await params
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) return {}
  const { cap, flow } = res
  const title = `wallets.gallery - ${cap.view.app.name}`
  const description = `${flow.name} in ${cap.view.app.name} on ${formatDate(cap.view.captureDate)}`
  return { title, description, openGraph: { title, description } }
}

export default async function FlowStandalonePage({
  params,
}: {
  params: Promise<{ slug: string; date: string; flowSlug: string }>
}) {
  const { slug, date, flowSlug } = await params
  const res = resolveFlow(slug, flowSlug, date)
  if (!res) notFound()
  const { cap, flow } = res
  return (
    <FlowPage
      view={cap.view}
      flow={flow}
      appSlug={slug}
      appLogo={cap.app.logo}
      date={cap.date}
    />
  )
}
