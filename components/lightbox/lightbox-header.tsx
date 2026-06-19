import Link from "next/link"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

// The single-row header shared by BOTH viewers (screen + flow) in BOTH forms
// (modal + standalone page): a breadcrumb of the app's logo + name, a divider,
// then the current item's title. The logo/name is a Link back to this capture's
// gallery (its date) — built by the caller via captureBase/flowsHref so the
// latest/date split stays in one place. `onClose` is set only by the modal,
// which renders a trailing X; the page leaves it off (the site header is its nav).
export function LightboxHeader({
  appSlug,
  appName,
  backHref,
  title,
  onClose,
}: {
  appSlug: string
  appName: string
  backHref: string
  title: string
  onClose?: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-2.5">
      <Link
        href={backHref}
        className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://avatar.vercel.sh/${appSlug}`}
          alt={appName}
          className="h-7 w-7 rounded-lg"
        />
        <span className="font-medium">{appName}</span>
      </Link>

      <span className="h-5 w-px shrink-0 bg-border" aria-hidden />

      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>

      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1.5 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
