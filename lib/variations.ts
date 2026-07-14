// Stable, human-readable URL value for a named screen variation. Display names
// remain untouched in the UI; only their deep-link representation is normalized.
export function variationParam(name: string): string {
  return name
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// A flow variation belongs to the one step named by ?step. Other steps may use
// the same label, but a deep link must never switch them as a side effect.
export function variationForStep(
  variation: string | null,
  addressedIndex: number,
  stepIndex: number
): string | null {
  return stepIndex === addressedIndex ? variation : null
}
