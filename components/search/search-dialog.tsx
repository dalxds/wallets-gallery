"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchSearchIndex } from "@/lib/data"
import type { SearchEntry } from "@/lib/types"
import Fuse from "fuse.js"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Smartphone,
  Monitor,
  GitBranch,
  Footprints,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const typeConfig = {
  app: { icon: Smartphone, label: "Apps" },
  flow: { icon: GitBranch, label: "Flows" },
  screen: { icon: Monitor, label: "Screens" },
  step: { icon: Footprints, label: "Steps" },
} as const

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter()
  const [index, setIndex] = useState<SearchEntry[]>([])
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const loadedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && !loadedRef.current) {
      loadedRef.current = true
      fetchSearchIndex()
        .then(setIndex)
        .catch(() => {
          loadedRef.current = false
        })
    }
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const fuse = useMemo(() => {
    if (index.length === 0) return null
    return new Fuse(index, {
      keys: [
        { name: "label", weight: 2 },
        { name: "appName", weight: 1.5 },
        { name: "description", weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    })
  }, [index])

  const results =
    fuse && query.length >= 2 ? fuse.search(query, { limit: 20 }) : []

  // Flat list for keyboard nav
  const flatResults = results.map((r) => r.item)

  // Group for display
  const grouped = (
    ["app", "flow", "screen", "step"] as const
  )
    .map((type) => ({
      type,
      ...typeConfig[type],
      items: results.filter((r) => r.item.type === type),
    }))
    .filter((g) => g.items.length > 0)

  function select(entry: SearchEntry) {
    onOpenChange(false)
    setQuery("")
    router.push(entry.href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      e.preventDefault()
      select(flatResults[selectedIndex])
    }
  }

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  let flatIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search apps, screens, flows..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-1">
          {query.length >= 2 && flatResults.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          )}
          {grouped.map((group) => {
            const Icon = group.icon
            return (
              <div key={group.type} className="p-1">
                <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((result) => {
                  const thisIndex = flatIndex++
                  return (
                    <button
                      key={`${result.item.type}-${result.item.href}-${result.item.label}`}
                      onClick={() => select(result.item)}
                      onMouseEnter={() => setSelectedIndex(thisIndex)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                        thisIndex === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{result.item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {result.item.appName}
                          {result.item.description &&
                            ` — ${result.item.description}`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
