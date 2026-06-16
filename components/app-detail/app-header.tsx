"use client"

import type { AppCapture, AppIndex } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppHeaderLayout } from "@/components/app-detail/app-header-layout"
import { CalendarDays } from "lucide-react"
import { useQueryState } from "nuqs"

interface AppHeaderProps {
  app: AppCapture
  appIndex: AppIndex
  currentDate: string
}

export function AppHeader({ app, appIndex, currentDate }: AppHeaderProps) {
  const [, setDateParam] = useQueryState("date")
  const [, setScreen] = useQueryState("screen")
  const [, setFlow] = useQueryState("flow")
  const [, setStep] = useQueryState("step")

  function handleDateChange(date: string) {
    setDateParam(date)
    setScreen(null)
    setFlow(null)
    setStep(null)
  }

  return (
    <AppHeaderLayout
      slug={app.app.slug}
      name={app.app.name}
      dateControl={
        <Select value={currentDate} onValueChange={handleDateChange}>
          <SelectTrigger
            size="sm"
            className="h-7 gap-1.5 rounded-full border-transparent bg-muted pr-2 pl-2.5 text-xs font-medium shadow-none hover:bg-accent focus-visible:ring-0 dark:bg-muted dark:hover:bg-accent"
          >
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {appIndex.captures.map((date) => (
              <SelectItem key={date} value={date}>
                {formatDate(date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  )
}
