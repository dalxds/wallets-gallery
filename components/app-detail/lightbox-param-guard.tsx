"use client"

import { useDropRestoredLightboxParams } from "@/hooks/use-restored-lightbox-params"

// Renders nothing. On an in-app navigation into the page it clears any lightbox
// params (?flow/?step/?screen) the Next.js static-export router-cache bug
// replayed from the URL the segment was first deep-linked with — keeping the
// active tab — so the lightbox doesn't spring back open. See the hook for the
// full explanation. The matching islands mask the same restored params to avoid
// a flash before this clears them.
export function LightboxParamGuard() {
  useDropRestoredLightboxParams()
  return null
}
