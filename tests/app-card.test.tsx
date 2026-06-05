import { describe, it, expect, vi } from "vitest"
import { render, within } from "@testing-library/react"
import { AppCard } from "@/components/browse/app-card"
import type { AppIndex, AppCapture } from "@/lib/types"

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockApp: AppIndex = {
  slug: "phantom",
  name: "Phantom",
  platform: "ios",
  captures: ["2026-04-01"],
  latest: "2026-04-01",
}

const mockCapture: AppCapture = {
  app: { name: "Phantom", slug: "phantom", bundleId: "com.phantom", platform: "ios" },
  captureDate: "2026-04-01",
  screens: [
    {
      id: "home",
      title: "Home",
      role: "home",
      description: "Home screen",
      screenshotPath: "assets/abc123.png",
      fingerprint: "sha256:abc123",
      texts: ["Home"],
      primaryCta: null,
      secondaryCtas: [],
      interactiveElements: [],
      appearsIn: [],
    },
    {
      id: "send",
      title: "Send",
      role: "form",
      description: "Send screen",
      screenshotPath: "assets/def456.png",
      fingerprint: "sha256:def456",
      texts: ["Send"],
      primaryCta: null,
      secondaryCtas: [],
      interactiveElements: [],
      appearsIn: [],
    },
  ],
  flows: [
    {
      slug: "send-crypto",
      name: "Send Crypto",
      parent: null,
      summary: "Send crypto flow",
      entryPoints: ["home"],
      replay: null,
      steps: [],
      nameSource: "mechanical",
    },
  ],
  decisionPoints: [],
  stats: { screens: 2, rawNodes: 2, flows: 1, topLevelFlows: 1, replayCoverage: 0 },
  namingTODO: [],
}

describe("AppCard", () => {
  describe("list view", () => {
    it("renders app name and links to detail page", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="list" />
      )
      const view = within(container)
      expect(view.getByText("Phantom")).toBeInTheDocument()
      expect(view.getByRole("link")).toHaveAttribute("href", "/apps/phantom")
    })

    it("shows screen and flow counts", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="list" />
      )
      const view = within(container)
      expect(view.getByText("2 screens")).toBeInTheDocument()
      expect(view.getByText("1 flows")).toBeInTheDocument()
    })

    it("shows formatted date", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="list" />
      )
      expect(within(container).getByText("Apr 1, 2026")).toBeInTheDocument()
    })

    it("shows 0 counts when no capture", () => {
      const { container } = render(<AppCard app={mockApp} view="list" />)
      const view = within(container)
      expect(view.getByText("0 screens")).toBeInTheDocument()
      expect(view.getByText("0 flows")).toBeInTheDocument()
    })
  })

  describe("grid view", () => {
    it("renders app name and links to detail page", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="grid" />
      )
      const view = within(container)
      expect(view.getByText("Phantom")).toBeInTheDocument()
      expect(view.getByRole("link")).toHaveAttribute("href", "/apps/phantom")
    })

    it("shows screen and flow counts", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="grid" />
      )
      const view = within(container)
      expect(view.getByText("2 screens")).toBeInTheDocument()
      expect(view.getByText("1 flows")).toBeInTheDocument()
    })

    it("renders avatar image", () => {
      const { container } = render(
        <AppCard app={mockApp} capture={mockCapture} view="grid" />
      )
      const img = within(container).getByAltText("Phantom")
      expect(img).toHaveAttribute("src", "https://avatar.vercel.sh/phantom")
    })
  })
})
