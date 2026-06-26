"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ArrowDownUp } from "lucide-react"

export type SortMode = "latest" | "alpha"

interface SortControlsProps {
  sort: SortMode
  onSortChange: (sort: SortMode) => void
}

export function SortControls({ sort, onSortChange }: SortControlsProps) {
  return (
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
  )
}
