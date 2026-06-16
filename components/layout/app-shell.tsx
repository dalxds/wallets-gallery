"use client"

import { SiteHeader } from "./site-header"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </TooltipProvider>
  )
}
