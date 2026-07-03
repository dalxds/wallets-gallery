"use client"

import type { FlowEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight, PanelLeftClose } from "lucide-react"
import { useMemo, useState } from "react"

interface FlowSidebarProps {
  flows: FlowEntry[]
  activeFlowSlug?: string
  onFlowClick: (slug: string) => void
  onCollapse?: () => void
  className?: string
}

function matchesFilter(flow: FlowEntry, q: string): boolean {
  if (!q) return true
  return (
    flow.name.toLowerCase().includes(q) ||
    flow.summary.toLowerCase().includes(q)
  )
}

function FlowNode({
  flow,
  allFlows,
  filter,
  activeFlowSlug,
  onFlowClick,
}: {
  flow: FlowEntry
  allFlows: FlowEntry[]
  filter: string
  activeFlowSlug?: string
  onFlowClick: (slug: string) => void
}) {
  const children = allFlows.filter((f) => f.parent === flow.slug)

  const q = filter.toLowerCase()
  const selfMatches = matchesFilter(flow, q)
  const visibleChildren = children.filter((child) =>
    childOrDescendantMatches(child, allFlows, q)
  )

  if (q && !selfMatches && visibleChildren.length === 0) {
    return null
  }

  const button = (
    <button
      type="button"
      onClick={() => onFlowClick(flow.slug)}
      className={cn(
        "flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
        activeFlowSlug === flow.slug && "bg-accent font-medium"
      )}
    >
      {flow.name}
    </button>
  )

  // Decide leaf vs expandable from the SAME list the content renders (visibleChildren),
  // not the unfiltered children — otherwise a filtered-out subtree still shows a chevron
  // that expands to an empty indented stub instead of rendering the parent as a leaf row.
  if (visibleChildren.length === 0) {
    return <div className="flex items-center">{button}</div>
  }

  return (
    <Collapsible defaultOpen>
      <div className="flex items-center">
        <CollapsibleTrigger className="flex h-7 w-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:rotate-90">
          <ChevronRight className="h-3 w-3 transition-transform" />
        </CollapsibleTrigger>
        {button}
      </div>
      <CollapsibleContent>
        <div className={cn("ml-3 flex flex-col gap-0.5 border-l pl-2")}>
          {visibleChildren.map((child) => (
            <FlowNode
              key={child.slug}
              flow={child}
              allFlows={allFlows}
              filter={filter}
              activeFlowSlug={activeFlowSlug}
              onFlowClick={onFlowClick}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function childOrDescendantMatches(
  flow: FlowEntry,
  allFlows: FlowEntry[],
  q: string
): boolean {
  if (matchesFilter(flow, q)) return true
  const children = allFlows.filter((f) => f.parent === flow.slug)
  return children.some((c) => childOrDescendantMatches(c, allFlows, q))
}

export function FlowSidebar({
  flows,
  activeFlowSlug,
  onFlowClick,
  onCollapse,
  className,
}: FlowSidebarProps) {
  const [filter, setFilter] = useState("")

  const topLevel = useMemo(
    () => flows.filter((f) => f.parent === null),
    [flows]
  )

  const q = filter.toLowerCase()
  const visibleTopLevel = topLevel.filter((f) =>
    childOrDescendantMatches(f, flows, q)
  )

  return (
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-1">
        <Input
          placeholder="Filter flows..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 text-sm"
        />
        {onCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="shrink-0 text-muted-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>
      <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain">
        {visibleTopLevel.map((flow) => (
          <FlowNode
            key={flow.slug}
            flow={flow}
            allFlows={flows}
            filter={filter}
            activeFlowSlug={activeFlowSlug}
            onFlowClick={onFlowClick}
          />
        ))}
      </nav>
    </div>
  )
}
