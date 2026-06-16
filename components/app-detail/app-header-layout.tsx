import type { ReactNode } from "react"

// The app header (avatar, name, and the capture date) is shown both by the
// interactive client (AppHeader, with a date <Select>) and by the search-param-
// free <Suspense> fallback (AppDetailStatic, with a plain date label). The
// shared chrome lives here so the two never drift on hydration; only the date
// control differs and is passed in as `dateControl`.
export function AppHeaderLayout({
  slug,
  name,
  dateControl,
}: {
  slug: string
  name: string
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
        <div className="mt-1 flex items-center gap-2">{dateControl}</div>
      </div>
    </div>
  )
}
