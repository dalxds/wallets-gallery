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
import { useState, useMemo } from "react"

interface FlowSidebarProps {
  flows: FlowEntry[]
  activeFlowSlug?: string
  onFlowClick: (slug: string) => void
}

function getSections(flows: FlowEntry[]) {
  const seen = new Set<string>()
  const sections: string[] = []
  for (const f of flows) {
    if (!seen.has(f.section)) {
      seen.add(f.section)
      sections.push(f.section)
    }
  }
  return sections
}

function formatSectionName(section: string) {
  return section.charAt(0).toUpperCase() + section.slice(1)
}

export function FlowSidebar({
  flows,
  activeFlowSlug,
  onFlowClick,
}: FlowSidebarProps) {
  const [filter, setFilter] = useState("")

  const getChildren = (parentSlug: string) =>
    flows.filter((f) => f.parent === parentSlug)

  const sections = useMemo(() => getSections(flows), [flows])

  const filteredFlowsBySection = useMemo(() => {
    const q = filter.toLowerCase()
    const result: Record<string, FlowEntry[]> = {}

    for (const section of sections) {
      const sectionFlows = flows.filter(
        (f) => f.section === section && !f.parent
      )
      const filtered = sectionFlows.filter((f) => {
        if (!q) return true
        const children = getChildren(f.slug)
        return (
          f.name.toLowerCase().includes(q) ||
          f.summary.toLowerCase().includes(q) ||
          section.toLowerCase().includes(q) ||
          children.some(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.summary.toLowerCase().includes(q)
          )
        )
      })
      if (filtered.length > 0) {
        result[section] = filtered
      }
    }
    return result
  }, [flows, filter, sections])

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Filter flows..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-8 text-sm"
      />
      <nav className="flex flex-col gap-1">
        {Object.entries(filteredFlowsBySection).map(
          ([section, sectionFlows]) => (
            <Collapsible key={section} defaultOpen>
              <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground [&[data-state=open]>svg]:rotate-90">
                <ChevronRight className="h-3 w-3 transition-transform" />
                {formatSectionName(section)}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-col gap-0.5">
                  {sectionFlows.map((flow) => {
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
                            ({flow.steps.length})
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
                              activeFlowSlug === flow.slug &&
                                "font-medium"
                            )}
                          >
                            {flow.name}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({flow.steps.length})
                          </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-4 flex flex-col gap-0.5 border-l pl-2">
                            <button
                              onClick={() =>
                                onFlowClick(flow.slug)
                              }
                              className={cn(
                                "rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
                                activeFlowSlug ===
                                  flow.slug &&
                                  "bg-accent font-medium"
                              )}
                            >
                              {flow.name}
                            </button>
                            {children.map((child) => (
                              <button
                                key={child.slug}
                                onClick={() =>
                                  onFlowClick(child.slug)
                                }
                                className={cn(
                                  "rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent",
                                  activeFlowSlug ===
                                    child.slug &&
                                    "bg-accent font-medium"
                                )}
                              >
                                {child.name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({child.steps.length})
                                </span>
                              </button>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        )}
      </nav>
    </div>
  )
}
