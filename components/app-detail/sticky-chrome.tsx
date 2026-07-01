"use client"

import { useEffect, useRef, type ReactNode } from "react"

// The pinned chrome (app header + tabs). A param-free client wrapper, so its
// server children (header, tabs) stay in the static prerender while it measures
// its own height and publishes it as --content-top on the detail root — the
// Flows sidebar rail sits exactly below it. Only fires on resize/content change,
// never on scroll.
export function StickyChrome({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = el.closest("[data-detail-root]") as HTMLElement | null
    if (!root) return
    const NAVBAR_PX = 56 // h-14
    const update = () =>
      root.style.setProperty("--content-top", `${NAVBAR_PX + el.offsetHeight}px`)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="space-y-6 lg:sticky lg:top-14 lg:z-30 lg:-mx-4 lg:-mt-6 lg:bg-background/80 lg:px-4 lg:pt-6 lg:pb-0 lg:backdrop-blur-sm"
    >
      {children}
    </div>
  )
}
