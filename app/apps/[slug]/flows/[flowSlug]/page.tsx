"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function FlowDetailRedirect() {
  const params = useParams<{ slug: string; flowSlug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const dateParam = searchParams.get("date")
    const qs = dateParam
      ? `?date=${dateParam}&tab=flows&flow=${params.flowSlug}`
      : `?tab=flows&flow=${params.flowSlug}`
    router.replace(`/apps/${params.slug}${qs}`)
  }, [params.slug, params.flowSlug, searchParams, router])

  return null
}
