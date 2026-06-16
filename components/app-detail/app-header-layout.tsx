import type { ReactNode } from "react"

// The app header (avatar, name, and a meta row of date · screens · flows) is
// shown both by the interactive client (AppHeader, with a date <Select>) and by
// the search-param-free <Suspense> fallback (AppDetailStatic, with a plain date
// label). The shared chrome lives here so the two never drift on hydration;
// only the date control differs and is passed in as `dateControl`.
export function AppHeaderLayout({
  slug,
  name,
  screens,
  flows,
  dateControl,
}: {
  slug: string
  name: string
  screens: number
  flows: number
  dateControl: ReactNode
}) {
  return (
    <div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://avatar.vercel.sh/${slug}`}
        alt={name}
        className="h-16 w-16 rounded-2xl"
      />
      <div>
        <h1 className="text-2xl font-bold">{name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {dateControl}
          <span>·</span>
          <span>{screens} screens</span>
          <span>·</span>
          <span>{flows} flows</span>
        </div>
      </div>
    </div>
  )
}
