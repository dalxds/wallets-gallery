import { describe, it, expect, vi } from "vitest"
import { render, within } from "@testing-library/react"
import { AppCard } from "@/components/browse/app-card"
import type { AppIndex } from "@/lib/types"

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
  cover: "assets/abc123.png",
  screens: 2,
  flows: 1,
}

const emptyApp: AppIndex = {
  ...mockApp,
  slug: "empty",
  name: "Empty",
  cover: "",
  screens: 0,
  flows: 0,
}

describe("AppCard", () => {
  describe("list view", () => {
    it("renders app name and links to detail page", () => {
      const { container } = render(<AppCard app={mockApp} view="list" />)
      const view = within(container)
      expect(view.getByText("Phantom")).toBeInTheDocument()
      expect(view.getByRole("link")).toHaveAttribute("href", "/apps/phantom")
    })

    it("shows screen and flow counts from the registry entry", () => {
      const { container } = render(<AppCard app={mockApp} view="list" />)
      const view = within(container)
      expect(view.getByText("2 screens")).toBeInTheDocument()
      expect(view.getByText("1 flows")).toBeInTheDocument()
    })

    it("shows formatted date", () => {
      const { container } = render(<AppCard app={mockApp} view="list" />)
      expect(within(container).getByText("Apr 1, 2026")).toBeInTheDocument()
    })

    it("shows 0 counts for an app with no screens/flows", () => {
      const { container } = render(<AppCard app={emptyApp} view="list" />)
      const view = within(container)
      expect(view.getByText("0 screens")).toBeInTheDocument()
      expect(view.getByText("0 flows")).toBeInTheDocument()
    })
  })

  describe("grid view", () => {
    it("renders app name and links to detail page", () => {
      const { container } = render(<AppCard app={mockApp} view="grid" />)
      const view = within(container)
      expect(view.getByText("Phantom")).toBeInTheDocument()
      expect(view.getByRole("link")).toHaveAttribute("href", "/apps/phantom")
    })

    it("shows screen and flow counts from the registry entry", () => {
      const { container } = render(<AppCard app={mockApp} view="grid" />)
      const view = within(container)
      expect(view.getByText("2 screens")).toBeInTheDocument()
      expect(view.getByText("1 flows")).toBeInTheDocument()
    })

    it("renders avatar image", () => {
      const { container } = render(<AppCard app={mockApp} view="grid" />)
      const img = within(container).getByAltText("Phantom")
      expect(img).toHaveAttribute("src", "https://avatar.vercel.sh/phantom")
    })

    it("renders the cover thumbnail when present", () => {
      const { container } = render(<AppCard app={mockApp} view="grid" />)
      const cover = within(container).getByAltText("Phantom preview")
      expect(cover).toHaveAttribute("src", "/captures/phantom/assets/abc123.png")
    })

    it("omits the cover thumbnail when absent", () => {
      const { container } = render(<AppCard app={emptyApp} view="grid" />)
      expect(within(container).queryByAltText("Empty preview")).toBeNull()
    })
  })
})
