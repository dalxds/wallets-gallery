import { ModalSkeleton } from "@/components/lightbox/modal-skeleton"

// Suspense fallback for the @modal slot: shown while the intercepted
// screen/flow route streams in on a soft nav, so the click feels instant.
export default function ModalLoading() {
  return <ModalSkeleton />
}
