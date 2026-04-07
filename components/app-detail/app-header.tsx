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
    <div className="flex items-center gap-4">
      <img
        src={`https://avatar.vercel.sh/${app.app.slug}`}
        alt={app.app.name}
        className="h-16 w-16 rounded-2xl"
      />
      <div>
        <h1 className="text-2xl font-bold">{app.app.name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Select
            value={currentDate}
            onValueChange={handleDateChange}
          >
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
          <span>·</span>
          <span>{app.screens.length} screens</span>
          <span>·</span>
          <span>{app.flows.length} flows</span>
        </div>
      </div>
    </div>
  )
}
