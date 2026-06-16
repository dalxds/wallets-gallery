import Link from "next/link"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          wallets gallery
        </Link>
      </div>
    </header>
  )
}
