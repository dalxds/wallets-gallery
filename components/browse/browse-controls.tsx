"use client"

import { useEffect } from "react"
import { useQueryState, parseAsStringLiteral } from "nuqs"
import { SortControls } from "@/components/browse/sort-controls"

const sorts = ["latest", "alpha"] as const

// Reads ?sort and reflects it onto the (server-rendered) #browse-grid as a data
// attribute; CSS does the actual reorder. This keeps the card list in the static
// prerender — only this small toolbar is client. It lives behind a <Suspense>
// because it reads searchParams; the cards default to latest (matching the static
// HTML) until it hydrates.
export function BrowseControls() {
  const [sort, setSort] = useQueryState(
    "sort",
    parseAsStringLiteral(sorts).withDefault("latest")
  )

  useEffect(() => {
    const grid = document.getElementById("browse-grid")
    if (!grid) return
    grid.dataset.sort = sort
  }, [sort])

  return <SortControls sort={sort} onSortChange={setSort} />
}
