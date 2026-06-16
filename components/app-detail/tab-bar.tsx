import { cn } from "@/lib/utils"

// The Screens/Flows strip is rendered both by the interactive client (as
// <button>s wired to nuqs) and by the search-param-free <Suspense> fallback (as
// inert <span>s). The container and the active-state styling live here so the
// two stay in sync; only the element type and click behavior differ per caller.

// Classes for one tab. `active` toggles the underline/colour; `interactive`
// adds the hover/transition affordances the client buttons use but the static
// spans omit (a span can't hover or change state).
export function tabClass({
  active,
  interactive,
}: {
  active: boolean
  interactive?: boolean
}) {
  return cn(
    "border-b-2 pb-2 text-sm font-medium",
    interactive && "transition-colors",
    active
      ? "border-primary"
      : cn(
          "border-transparent text-muted-foreground",
          interactive && "hover:text-foreground"
        )
  )
}

export interface TabItem {
  label: string
  count: number
  active: boolean
  /** Present only in the interactive client — its absence renders an inert span. */
  onSelect?: () => void
}

export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <div className="flex gap-4 border-b">
      {items.map((item) =>
        item.onSelect ? (
          <button
            key={item.label}
            onClick={item.onSelect}
            className={tabClass({ active: item.active, interactive: true })}
          >
            {item.label} ({item.count})
          </button>
        ) : (
          <span key={item.label} className={tabClass({ active: item.active })}>
            {item.label} ({item.count})
          </span>
        )
      )}
    </div>
  )
}
