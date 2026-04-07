import { describe, it, expect } from "vitest"
import { render, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("renders with default props", () => {
    const { container } = render(<Button>Click me</Button>)
    const button = within(container).getByRole("button", { name: "Click me" })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute("data-slot", "button")
    expect(button).toHaveAttribute("data-variant", "default")
    expect(button).toHaveAttribute("data-size", "default")
  })

  it("renders all variant types", () => {
    const variants = [
      "default",
      "outline",
      "secondary",
      "ghost",
      "destructive",
      "link",
    ] as const

    for (const variant of variants) {
      const { container, unmount } = render(
        <Button variant={variant}>{variant}</Button>
      )
      expect(within(container).getByRole("button")).toHaveAttribute(
        "data-variant",
        variant
      )
      unmount()
    }
  })

  it("renders all size types", () => {
    const sizes = [
      "default",
      "xs",
      "sm",
      "lg",
      "icon",
      "icon-xs",
      "icon-sm",
      "icon-lg",
    ] as const

    for (const size of sizes) {
      const { container, unmount } = render(<Button size={size}>btn</Button>)
      expect(within(container).getByRole("button")).toHaveAttribute(
        "data-size",
        size
      )
      unmount()
    }
  })

  it("applies custom className", () => {
    const { container } = render(<Button className="my-class">Custom</Button>)
    expect(within(container).getByRole("button")).toHaveClass("my-class")
  })

  it("forwards native button props", () => {
    const { container } = render(
      <Button type="submit" disabled>
        Submit
      </Button>
    )
    const button = within(container).getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("type", "submit")
  })

  it("handles click events", async () => {
    let clicked = false
    const { container } = render(
      <Button onClick={() => (clicked = true)}>Click</Button>
    )
    await userEvent.click(within(container).getByRole("button"))
    expect(clicked).toBe(true)
  })

  it("does not fire click when disabled", async () => {
    let clicked = false
    const { container } = render(
      <Button disabled onClick={() => (clicked = true)}>
        No
      </Button>
    )
    await userEvent.click(within(container).getByRole("button"))
    expect(clicked).toBe(false)
  })

  it("renders as child element when asChild is true", () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    const link = within(container).getByRole("link", { name: "Link Button" })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute("href", "/test")
    expect(link).toHaveAttribute("data-slot", "button")
  })
})
