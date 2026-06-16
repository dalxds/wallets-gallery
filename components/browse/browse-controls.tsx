"use client"

import { useEffect } from "react"
import { useQueryState, parseAsStringLiteral } from "nuqs"
import { SortControls } from "@/components/browse/sort-controls"

const sorts = ["latest", "alpha"] as const
const views = ["list", "grid"] as const

// Reads ?sort/?view and reflects them onto the (server-rendered) #browse-grid as
// data attributes; CSS does the actual reorder and list/grid layout. This keeps
// the card list in the static prerender — only this small toolbar is client. It
// lives behind a <Suspense> because it reads searchParams; the cards default to
// list/latest (matching the static HTML) until it hydrates.
export function BrowseControls() {
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringLiteral(sorts).withDefault("latest")
  )
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(views).withDefault("list")
  )

  useEffect(() => {
    const grid = document.getElementById("browse-grid")
    if (!grid) return
    grid.dataset.sort = sort
    grid.dataset.view = view
  }, [sort, view])

  return (
    <SortControls
      sort={sort}
      onSortChange={setSort}
      view={view}
      onViewChange={setView}
    />
  )
}
