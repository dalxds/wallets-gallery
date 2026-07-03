import { SiteHeader } from "./site-header"

// A server component: SiteHeader is static markup and nothing here needs the client.
// (There is no TooltipProvider anymore — nothing in the app rendered a Tooltip. A future
// Tooltip consumer must bring its own provider, or use shadcn's per-Tooltip provider pattern.)
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </>
  )
}
