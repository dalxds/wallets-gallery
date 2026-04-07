"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function FlowsRedirect() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const dateParam = searchParams.get("date")
    const qs = dateParam ? `?date=${dateParam}&tab=flows` : "?tab=flows"
    router.replace(`/apps/${params.slug}${qs}`)
  }, [params.slug, searchParams, router])

  return null
}
