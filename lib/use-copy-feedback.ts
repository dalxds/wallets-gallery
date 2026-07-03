import { useCallback, useEffect, useRef, useState } from "react"

// One implementation of the "flash a copied-confirmation, then clear it" state that every
// copy/download button shares — instead of re-rolling useState + setTimeout(1500) in seven
// places (none of which cleared the timer on unmount → a setState-after-unmount leak when a
// viewer closes mid-flash). Generic over the flashed value so a link button flashes `true`
// and an image button flashes "image" | "url" (the copyImageToClipboard outcome) through the
// same primitive. Returns [value | null, flash] — null is idle.
export function useCopyFeedback<T>(ms = 1500): readonly [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const flash = useCallback(
    (v: T) => {
      setValue(v)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setValue(null), ms)
    },
    [ms]
  )
  return [value, flash]
}
