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
  logo: null,
}

describe("AppCard", () => {
  it("renders app name and links to the latest dated capture", () => {
    const { container } = render(<AppCard app={mockApp} />)
    const view = within(container)
    expect(view.getByText("Phantom")).toBeInTheDocument()
    expect(view.getByRole("link")).toHaveAttribute(
      "href",
      "/apps/phantom/2026-04-01"
    )
  })

  it("shows the formatted latest capture date", () => {
    const { container } = render(<AppCard app={mockApp} />)
    expect(within(container).getByText("Apr 1, 2026")).toBeInTheDocument()
  })

  it("falls back to the generated avatar when the app has no logo", () => {
    const { container } = render(<AppCard app={mockApp} />)
    const img = within(container).getByAltText("Phantom")
    expect(img).toHaveAttribute("src", "https://avatar.vercel.sh/phantom")
  })

  it("uses the committed logo when the app has one", () => {
    const { container } = render(
      <AppCard app={{ ...mockApp, logo: "logo.png" }} />
    )
    const img = within(container).getByAltText("Phantom")
    expect(img).toHaveAttribute("src", "/captures/phantom/logo.png")
  })

  it("does not show screen or flow counts", () => {
    const { container } = render(<AppCard app={mockApp} />)
    const view = within(container)
    expect(view.queryByText(/screens?/)).toBeNull()
    expect(view.queryByText(/flows?/)).toBeNull()
  })

  it("does not render a cover thumbnail", () => {
    const { container } = render(<AppCard app={mockApp} />)
    expect(within(container).queryByAltText("Phantom preview")).toBeNull()
  })
})
