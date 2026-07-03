// Strip the server-only bulk off a View before it crosses into a client island. `view.json`
// stays full (archival, read server-side by OG / llms.txt); these just drop the fields no UI
// component reads — a screen's `texts` + `interactiveElements` and a flow's `replay` — so the
// RSC payload doesn't ship ~90KB per capture of dead data. Pure; runs in server components.

import type { View, ViewScreen, ViewFlow } from "./packager/types"
import type { ClientScreen, ClientFlow, ClientCapture } from "./types"

export function toClientScreen(screen: ViewScreen): ClientScreen {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit-via-rest: drop these two
  const { texts, interactiveElements, ...rest } = screen
  return rest
}
export function toClientFlow(flow: ViewFlow): ClientFlow {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit-via-rest: drop replay
  const { replay, ...rest } = flow
  return rest
}
export function toClientScreens(screens: ViewScreen[]): ClientScreen[] {
  return screens.map(toClientScreen)
}
export function toClientFlows(flows: ViewFlow[]): ClientFlow[] {
  return flows.map(toClientFlow)
}
export function toClientCapture(view: View): ClientCapture {
  return { ...view, screens: toClientScreens(view.screens), flows: toClientFlows(view.flows) }
}
