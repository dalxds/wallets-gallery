import { ModalSkeleton } from "@/components/lightbox/modal-skeleton"

// Suspense fallback for THIS intercepted route only — so a tile click shows the
// modal skeleton while the flow RSC streams, without flashing for non-intercept
// soft navs (tab/date switches) that resolve the @modal slot to the null
// catch-all. (Was a single slot-wide @modal/loading.tsx, which covered those too.)
export default function Loading() {
  return <ModalSkeleton />
}
