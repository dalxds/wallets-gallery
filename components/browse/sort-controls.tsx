"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowDownUp, LayoutGrid, LayoutList } from "lucide-react"

export type SortMode = "latest" | "alpha"
export type ViewMode = "list" | "grid"

interface SortControlsProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
  view: ViewMode
  onViewChange: (view: ViewMode) => void
}

export function SortControls({
  sort,
  onSortChange,
  view,
  onViewChange,
}: SortControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowDownUp className="mr-2 h-3.5 w-3.5" />
            {sort === "latest" ? "Latest" : "A–Z"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSortChange("latest")}>
            Latest capture
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onSortChange("alpha")}>
            Alphabetical
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex rounded-md border">
        <Button
          variant={view === "list" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-r-none border-0"
          onClick={() => onViewChange("list")}
        >
          <LayoutList className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={view === "grid" ? "secondary" : "ghost"}
          size="sm"
          className="rounded-l-none border-0"
          onClick={() => onViewChange("grid")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
