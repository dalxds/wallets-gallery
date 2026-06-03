import type { ScreenEntry } from "./types"

// Presentation for each screen state. `tone` drives styling: empty/loading are
// normal lifecycle states (neutral); error/max are exceptional (warning).
export const STATE_META: Record<
  string,
  { label: string; tone: "neutral" | "warning"; order: number }
> = {
  default: { label: "Default", tone: "neutral", order: 0 },
  empty: { label: "Empty", tone: "neutral", order: 1 },
  loading: { label: "Loading", tone: "neutral", order: 2 },
  max: { label: "Max", tone: "warning", order: 3 },
  error: { label: "Error", tone: "warning", order: 4 },
}

export function stateMeta(state: string) {
  return (
    STATE_META[state] ?? {
      label: state.charAt(0).toUpperCase() + state.slice(1),
      tone: "neutral" as const,
      order: 9,
    }
  )
}

export interface StateIndex {
  /**
   * The state-variants of a screen, sharing its `stateGroup`, ordered default-first.
   * Returns [] when the screen has no group or the group has a single member — i.e.
   * there is nothing to switch between.
   */
  variantsForScreen(screenId: string): ScreenEntry[]
}

export function buildStateIndex(screens: ScreenEntry[]): StateIndex {
  const byGroup = new Map<string, ScreenEntry[]>()
  for (const s of screens) {
    if (!s.stateGroup) continue
    const arr = byGroup.get(s.stateGroup) ?? []
    arr.push(s)
    byGroup.set(s.stateGroup, arr)
  }
  for (const arr of byGroup.values()) {
    arr.sort(
      (a, b) => stateMeta(a.state ?? "default").order - stateMeta(b.state ?? "default").order
    )
  }
  const byId = new Map(screens.map((s) => [s.id, s]))
  return {
    variantsForScreen(screenId) {
      const s = byId.get(screenId)
      if (!s?.stateGroup) return []
      const group = byGroup.get(s.stateGroup) ?? []
      return group.length > 1 ? group : []
    },
  }
}
