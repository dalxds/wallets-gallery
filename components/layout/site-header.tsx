"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface SiteHeaderProps {
  onSearchOpen: () => void
}

export function SiteHeader({ onSearchOpen }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          inspo
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden w-64 justify-start text-muted-foreground sm:flex"
            onClick={onSearchOpen}
          >
            <Search className="mr-2 h-4 w-4" />
            Search...
            <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={onSearchOpen}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
