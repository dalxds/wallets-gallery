"use client"

import { SiteHeader } from "./site-header"
import { SearchDialog } from "@/components/search/search-dialog"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEffect, useState } from "react"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <TooltipProvider>
      <SiteHeader onSearchOpen={() => setSearchOpen(true)} />
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </TooltipProvider>
  )
}
