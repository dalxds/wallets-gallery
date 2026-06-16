"use client"

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

const typeConfig = {
  app: { icon: Smartphone, label: "Apps" },
  flow: { icon: GitBranch, label: "Flows" },
  screen: { icon: Monitor, label: "Screens" },
  step: { icon: Footprints, label: "Steps" },
} as const

// The dialog's query + selection state lives here, not in SearchDialog. Radix
// mounts this subtree when the dialog opens and unmounts it on close, so every
// open starts fresh (empty query, selection at 0) without a reset effect. The
// loaded index is owned by the parent and passed in, so it survives across opens.
export function SearchResults({
  index,
  onOpenChange,
}: {
  index: SearchEntry[]
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input on open. This subtree mounts when the dialog opens, so a
  // mount effect runs once per open; the 0ms timeout defers past Radix's focus trap.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [])

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
  const grouped = (["app", "flow", "screen", "step"] as const)
    .map((type) => ({
      type,
      ...typeConfig[type],
      items: results.filter((r) => r.item.type === type),
    }))
    .filter((g) => g.items.length > 0)

  function select(entry: SearchEntry) {
    onOpenChange(false)
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

  let flatIndex = 0

  return (
    <>
      {/* Search input */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            // Resetting selection on each query change belongs in the handler
            // that changes the query — not a separate query-watching effect.
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          aria-label="Search apps, screens, flows"
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
                    type="button"
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
    </>
  )
}
