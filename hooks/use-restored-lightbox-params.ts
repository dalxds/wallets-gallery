"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

// The query params that drive a lightbox open. Stripping these (and keeping the
// rest, e.g. ?tab) closes the lightbox without changing which tab you land on.
const LIGHTBOX_PARAMS = ["flow", "step", "screen"] as const

// Flipped true the first time the app performs a client-side navigation
// (pushState) or a back/forward (popstate). A fresh document load starts it
// false and it resets on the next full load. Keyed off the navigation itself —
// not a mount — so it's immune to the order/timing in which islands mount
// (notably Suspense, which can delay an island past a sibling's effects).
let clientHasNavigated = false

if (typeof window !== "undefined" && !("__lightboxNavSpy" in window.history)) {
  Object.defineProperty(window.history, "__lightboxNavSpy", { value: true })
  const original = window.history.pushState.bind(window.history)
  window.history.pushState = function patchedPushState(
    ...args: Parameters<History["pushState"]>
  ) {
    clientHasNavigated = true
    return original(...args)
  }
  window.addEventListener("popstate", () => {
    clientHasNavigated = true
  })
}

// True only for the initial document load (no client navigation has happened
// yet). Captured per mount, so a deep link is honored while any later arrival —
// which can only follow a navigation — is treated as such.
function useIsInitialPageLoad(): boolean {
  const [isInitial] = useState(() => !clientHasNavigated)
  return isInitial
}

// Works around a confirmed Next.js App Router bug in static exports
// (vercel/next.js#92187, a 16.2.x regression): the router replays the URL a
// route segment was *first loaded with*, so after someone deep-links a lightbox
// (?flow=…/?screen=…), closes it, and later navigates back into the app via a
// bare <Link href="/apps/[slug]">, that stale URL is restored and the lightbox
// springs back open.
//
// `useMaskedLightboxParam` hides the restored value from the island so the
// lightbox stays shut (no flash), while `useDropRestoredLightboxParams` clears
// those params from the URL — keeping the rest (the tab) intact. A shallow
// update gets undone by the same bug, so it uses an explicit router.replace,
// which overrides the replayed URL.

// Masks a lightbox param: a value present on an in-app (re)mount is "restored"
// (stale) and read as null until it's cleared from the URL; afterwards, and on
// the initial load, the value passes through so deep links and user-opened
// lightboxes work normally.
export function useMaskedLightboxParam(value: string | null): string | null {
  const isInitial = useIsInitialPageLoad()
  const [restored, setRestored] = useState(() => !isInitial && value !== null)
  // Stop masking once the restored value is actually gone (cleared by the guard,
  // or never set), so values the user sets later in this mount are honored.
  // Adjusting state during render — fires once (restored only flips true→false),
  // so it settles without an extra commit.
  if (restored && value === null) {
    setRestored(false)
  }
  return restored ? null : value
}

// On an in-app navigation into an app page, drop the restored lightbox params,
// leaving the rest of the URL untouched. Call once per page.
export function useDropRestoredLightboxParams(): void {
  const isInitial = useIsInitialPageLoad()
  const router = useRouter()
  useEffect(() => {
    if (isInitial) return
    const url = new URL(window.location.href)
    let changed = false
    for (const param of LIGHTBOX_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        changed = true
      }
    }
    if (changed) {
      router.replace(url.pathname + url.search + url.hash, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
