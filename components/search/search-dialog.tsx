"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { fetchSearchIndex } from "@/lib/data"
import type { SearchEntry } from "@/lib/types"
import { useEffect, useRef, useState } from "react"
import { SearchResults } from "./search-results"

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [index, setIndex] = useState<SearchEntry[]>([])
  const loadedRef = useRef(false)

  // Load the search index once, the first time the dialog opens, then cache it:
  // this component stays mounted across opens, so the fetch never repeats. The
  // ignore flag prevents a setState if the dialog closes before the fetch lands.
  useEffect(() => {
    if (!open || loadedRef.current) return
    loadedRef.current = true
    let ignore = false
    fetchSearchIndex()
      .then((entries) => {
        if (!ignore) setIndex(entries)
      })
      .catch(() => {
        loadedRef.current = false
      })
    return () => {
      ignore = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-1/3 translate-y-0 overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <SearchResults index={index} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}
