"use client"

import type { FlowEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"
import { useState } from "react"

interface FlowSidebarProps {
  flows: FlowEntry[]
  activeFlowSlug?: string
  onFlowClick: (slug: string) => void
}

export function FlowSidebar({
  flows,
  activeFlowSlug,
  onFlowClick,
}: FlowSidebarProps) {
  const [filter, setFilter] = useState("")

  const topLevel = flows.filter((f) => !f.parent)
  const getChildren = (parentSlug: string) =>
    flows.filter((f) => f.parent === parentSlug)

  const filtered = topLevel.filter((f) => {
    const q = filter.toLowerCase()
    if (!q) return true
    const children = getChildren(f.slug)
    return (
      f.name.toLowerCase().includes(q) ||
      f.summary.toLowerCase().includes(q) ||
      children.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q)
      )
    )
  })

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Filter flows..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-8 text-sm"
      />
      <nav className="flex flex-col gap-0.5">
        {filtered.map((flow) => {
          const children = getChildren(flow.slug)
          if (children.length === 0) {
            return (
              <button
                key={flow.slug}
                onClick={() => onFlowClick(flow.slug)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  activeFlowSlug === flow.slug &&
                    "bg-accent font-medium"
                )}
              >
                {flow.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({flow.stepsCount})
                </span>
              </button>
            )
          }

          return (
            <Collapsible key={flow.slug} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent [&[data-state=open]>svg]:rotate-90">
                <ChevronRight className="h-3 w-3 transition-transform" />
                <span
                  className={cn(
                    activeFlowSlug === flow.slug && "font-medium"
                  )}
                >
                  {flow.name}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({flow.stepsCount})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-4 flex flex-col gap-0.5 border-l pl-2">
                  <button
                    onClick={() => onFlowClick(flow.slug)}
                    className={cn(
                      "rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
                      activeFlowSlug === flow.slug &&
                        "bg-accent font-medium"
                    )}
                  >
                    {flow.name}
                  </button>
                  {children.map((child) => (
                    <button
                      key={child.slug}
                      onClick={() => onFlowClick(child.slug)}
                      className={cn(
                        "rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
                        activeFlowSlug === child.slug &&
                          "bg-accent font-medium"
                      )}
                    >
                      {child.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({child.stepsCount})
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </nav>
    </div>
  )
}
