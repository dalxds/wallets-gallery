import { ModalSkeleton } from "@/components/lightbox/modal-skeleton"

// Suspense fallback for the historical-capture @modal slot (mirrors the latest
// level): shown while the intercepted screen/flow route streams in on a soft nav.
export default function ModalLoading() {
  return <ModalSkeleton />
}
