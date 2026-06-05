import { AppShell } from "@/components/layout/app-shell"

// Rendered both as the static prerender fallback (the client subtree reads
// search params, so it must suspend during export) and as the client's own
// loading state while index.json + view.json fetch — keeping the hand-off
// from prerendered HTML to hydrated client visually seamless.
export function AppDetailSkeleton() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-muted"
              style={{ aspectRatio: "9/19.5" }}
            />
          ))}
        </div>
      </div>
    </AppShell>
  )
}
