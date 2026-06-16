"use client"

import { useRouter } from "next/navigation"
import { dateHref } from "@/lib/links"
import { formatDate } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

// The capture-date picker. Date is a route segment, so changing it navigates to
// that date's prerendered page — no ?date param, no client fetch. Reads no
// searchParams, so it stays in the static prerender. The trigger is text +
// chevron only: no border, padding, background, or hover fill (the base's
// dark-mode hover bg is overridden too); the dropdown opens below on click.
export function DateControl({
  slug,
  captures,
  currentDate,
  latest,
}: {
  slug: string
  captures: string[]
  currentDate: string
  latest: string
}) {
  const router = useRouter()
  return (
    <Select
      value={currentDate}
      onValueChange={(date) => router.push(dateHref(slug, date, latest))}
    >
      <SelectTrigger
        size="sm"
        className="h-auto border-0 bg-transparent p-0 shadow-none data-[size=sm]:h-auto dark:bg-transparent dark:hover:bg-transparent"
      >
        {/* Render the formatted date directly instead of <SelectValue/>: the
            latter renders empty during SSR (Radix only resolves the selected
            item's text on hydration), which pops in. Date is route-controlled,
            so this static value is always correct. */}
        {formatDate(currentDate)}
      </SelectTrigger>
      {/* position="popper", not the default item-aligned: this trigger lives inside
          the sticky, backdrop-blurred header chrome, where Radix's item-aligned
          positioning miscomputes and drops the list at the document bottom
          (top = scrollHeight, off-screen). popper anchors to the trigger. */}
      <SelectContent position="popper" align="start">
        {captures.map((date) => (
          <SelectItem key={date} value={date}>
            {formatDate(date)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
