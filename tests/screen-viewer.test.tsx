import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ScreenViewer } from "@/components/lightbox/screen-viewer"
import type { ClientFlow, ClientScreen } from "@/lib/types"

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}))

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock("next/image", () => ({
  default: (
    props: React.ComponentProps<"img"> & {
      fill?: boolean
      preload?: boolean
    }
  ) => {
    const { fill, preload, ...imageProps } = props
    void fill
    void preload
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img {...imageProps} alt={imageProps.alt ?? ""} />
    )
  },
}))

const screens = [
  {
    id: "gold-detail",
    title: "Asset detail",
    role: "other",
    description: "Gold",
    screenshotPath: "assets/gold.png",
    state: "Gold",
    stateGroup: "asset-detail",
    appearsIn: [{ flow: "viewing-assets", step: 2 }],
  },
] as ClientScreen[]

const flows = [
  {
    id: "viewing-assets",
    slug: "viewing-assets",
    name: "Viewing assets",
    parent: null,
    summary: "",
    entryPoints: [],
    steps: [
      {
        number: 2,
        title: "Asset detail",
        screenId: "asset-detail",
        action: "Open asset",
        screenshotPath: "assets/asset.png",
        kind: "screen",
      },
    ],
  },
] as ClientFlow[]

describe("ScreenViewer flow chips", () => {
  it("pushes a history entry and preserves the viewed variation", async () => {
    push.mockClear()
    render(
      <ScreenViewer
        screens={screens}
        flows={flows}
        initialScreenId="gold-detail"
        appSlug="avici"
        appName="Avici"
        appLogo={null}
        backHref="/apps/avici/2026-06-23"
        date="2026-06-23"
      />
    )

    await userEvent.click(
      screen.getByRole("button", { name: "Viewing assets" })
    )

    expect(push).toHaveBeenCalledWith(
      "/apps/avici/2026-06-23/flow/viewing-assets?step=2&variation=gold"
    )
  })
})
