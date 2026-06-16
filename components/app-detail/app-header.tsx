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
      screens={app.screens.length}
      flows={app.flows.length}
      dateControl={
        <Select value={currentDate} onValueChange={handleDateChange}>
          <SelectTrigger size="sm" className="h-7 text-xs">
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
