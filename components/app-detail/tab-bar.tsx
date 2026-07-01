"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

// The Screens/Flows strip. Each tab is a real <Link> to its own prerendered
// route — Screens is the capture base, Flows is base + "/flows" — so switching
// tabs is a soft navigation the App Router prefetches (both targets are static),
// not client state and not a ?tab query. The active tab is derived from the path
// (usePathname), which re-renders this bar on navigation without re-rendering the
// server layout that hosts it. usePathname doesn't opt the page out of static
// generation (unlike useSearchParams), so the panels stay prerendered.
const tabClass =
  "border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
const activeClass = "border-primary text-foreground"
// The count rides as a superscript in a lighter tone, so it reads as secondary
// to the tab label instead of competing with it like the old "(12)" did.
const countClass =
  "ml-0.5 text-[0.65rem] font-normal tabular-nums text-muted-foreground/70"

export function TabBar({
  base,
  screensCount,
  flowsCount,
}: {
  base: string
  screensCount: number
  flowsCount: number
}) {
  const pathname = usePathname()
  const onFlows = pathname === `${base}/flows`
  return (
    <div className="flex gap-4 border-b">
      <Link href={base} className={cn(tabClass, !onFlows && activeClass)}>
        Screens
        <sup className={countClass}>{screensCount}</sup>
      </Link>
      <Link
        href={`${base}/flows`}
        className={cn(tabClass, onFlows && activeClass)}
      >
        Flows
        <sup className={countClass}>{flowsCount}</sup>
      </Link>
    </div>
  )
}
