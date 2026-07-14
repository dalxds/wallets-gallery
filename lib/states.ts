import type { ClientScreen } from "./types"

// Presentation for screen derivations. Lifecycle states retain their special
// ordering/tone; custom values label entity, carousel, or other variations.
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
  if (STATE_META[state]) return STATE_META[state]
  // Numeric labels are carousel/onboarding step numbers ("1","2","3"): order by the
  // number so the switcher keeps slide order regardless of input order, and place them
  // after the lifecycle states. Any other custom label is a neutral, capitalized fallback.
  if (/^\d+$/.test(state))
    return {
      label: state,
      tone: "neutral" as const,
      order: 100 + Number(state),
    }
  return {
    label: state.charAt(0).toUpperCase() + state.slice(1),
    tone: "neutral" as const,
    order: 9,
  }
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export interface StateIndex {
  /**
   * The derivations of a screen, sharing its `stateGroup`, in stable label order.
   * Returns [] when the screen has no group or the group has a single member — i.e.
   * there is nothing to switch between.
   */
  variantsForScreen(
    screenId: string,
    eligibleIds?: readonly string[]
  ): ClientScreen[]
}

export function buildStateIndex(screens: ClientScreen[]): StateIndex {
  const byGroup = new Map<string, ClientScreen[]>()
  for (const s of screens) {
    if (!s.stateGroup) continue
    const arr = byGroup.get(s.stateGroup) ?? []
    arr.push(s)
    byGroup.set(s.stateGroup, arr)
  }
  for (const arr of byGroup.values()) {
    arr.sort((a, b) => {
      const aMeta = stateMeta(a.state ?? "default")
      const bMeta = stateMeta(b.state ?? "default")
      return (
        aMeta.order - bMeta.order ||
        compareCodePoints(aMeta.label, bMeta.label) ||
        compareCodePoints(a.id, b.id)
      )
    })
  }
  const byId = new Map(screens.map((s) => [s.id, s]))
  return {
    variantsForScreen(screenId, eligibleIds) {
      const s = byId.get(screenId)
      if (!s?.stateGroup) return []
      const group = byGroup.get(s.stateGroup) ?? []
      const eligible = eligibleIds
        ? group.filter((variant) => eligibleIds.includes(variant.id))
        : group
      return eligible.length > 1 ? eligible : []
    },
  }
}
