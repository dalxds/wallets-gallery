"use client"

import { useEffect } from "react"
import { useQueryState, parseAsStringLiteral } from "nuqs"

const tabs = ["screens", "flows"] as const

// Reflects ?tab onto [data-detail-root][data-active-tab] so CSS shows the active
// panel and highlights the active tab — without the panels or chrome themselves
// reading searchParams, which would de-opt their static prerender. Renders
// nothing; lives behind a <Suspense> because it reads searchParams.
export function TabState() {
  const [tab] = useQueryState(
    "tab",
    parseAsStringLiteral(tabs).withDefault("screens")
  )
  useEffect(() => {
    document.getElementById("app-detail-root")?.setAttribute("data-active-tab", tab)
  }, [tab])
  return null
}
