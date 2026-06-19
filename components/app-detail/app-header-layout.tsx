import type { ReactNode } from "react"

// The app header (avatar, name, capture date), rendered once in the gallery
// chrome (GalleryFrame, in the persisted (gallery) layout). Presentational: the
// date control is passed in as `dateControl` so this component reads no data and
// can sit untouched in the static prerender.
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
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          {dateControl}
        </div>
      </div>
    </div>
  )
}
