import { describe, it, expect } from "vitest"
import { render, within, fireEvent } from "@testing-library/react"
import { LazyImage } from "@/components/shared/lazy-image"

describe("LazyImage", () => {
  it("renders an img with correct src and alt", () => {
    const { container } = render(<LazyImage src="/test.png" alt="Test image" />)
    const img = within(container).getByAltText("Test image")
    expect(img).toHaveAttribute("src", "/test.png")
    expect(img).toHaveAttribute("loading", "lazy")
  })

  it("starts with opacity-0 before load", () => {
    const { container } = render(<LazyImage src="/test.png" alt="Test" />)
    const img = within(container).getByAltText("Test")
    expect(img.className).toContain("opacity-0")
  })

  it("shows opacity-100 after image loads", () => {
    const { container } = render(<LazyImage src="/test.png" alt="Test" />)
    const img = within(container).getByAltText("Test")
    fireEvent.load(img)
    expect(img.className).toContain("opacity-100")
  })

  it("applies default aspect ratio 9/19.5", () => {
    const { container } = render(<LazyImage src="/test.png" alt="Test" />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.aspectRatio).toBe("9/19.5")
  })

  it("applies custom aspect ratio", () => {
    const { container } = render(
      <LazyImage src="/test.png" alt="Test" aspectRatio="16/9" />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.aspectRatio).toBe("16/9")
  })

  it("applies custom className to container", () => {
    const { container } = render(
      <LazyImage src="/test.png" alt="Test" className="rounded-xl" />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain("rounded-xl")
  })
})
