import Link from "next/link"

// The Screens/Flows strip. Tabs are real <Link>s into ?tab, so they work without
// JS and — crucially — read no searchParams, which keeps the chrome in the static
// prerender. The active state is CSS-driven off [data-active-tab] on the detail
// root (see globals.css), which the TabState island reflects from ?tab; the
// default (attribute absent) is screens, matching the prerendered HTML. The
// relative `?tab=…` href also drops ?screen/?flow/?step (closing any open
// lightbox) and preserves the /apps/[slug]/[date] path segment.
const tabClass =
  "app-tab border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"

export function TabBar({
  screensCount,
  flowsCount,
}: {
  screensCount: number
  flowsCount: number
}) {
  return (
    <div className="flex gap-4 border-b">
      <Link href="?tab=screens" data-tab-btn="screens" className={tabClass}>
        Screens ({screensCount})
      </Link>
      <Link href="?tab=flows" data-tab-btn="flows" className={tabClass}>
        Flows ({flowsCount})
      </Link>
    </div>
  )
}
