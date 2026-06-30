import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { captureUrl } from "@/lib/images"
import { assetBaseUrl } from "@/lib/site"
import { formatDate } from "@/lib/utils"
import type { AppCapture, FlowEntry, ScreenEntry } from "@/lib/types"

// Shared Open Graph card renderers (1200×630) for the site, app, screen, and flow
// routes. Server-only (Node runtime). The look mirrors the app itself: a near-black
// card (the app's dark `--background`), Inter at the app's weights, white/10%
// borders, the app's corner radii, and screenshots framed flat like the in-app
// tiles. Colour is a whisper — one soft radial of the app's brand hue in the
// background — never gradient text or glow.
// Two things are pulled in at render time and embedded into the satori card:
//   • screenshot PNGs — FETCHED from the CDN (static assets in public/) and inlined
//     as base64. Fetching over HTTP keeps these functions code-only: no image bytes
//     traced into the lambda (wouldn't scale to ~50k screenshots). Content-addressed
//     assets are immutable, so force-cache composites each shot at most once.
//   • each app's brand colours — the two stops of its avatar.vercel.sh gradient (the
//     same gradient the site renders as the app's avatar). Fetched + force-cached;
//     a deterministic slug-hash fallback covers a miss.

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = "image/png"

// ── Typefaces ──────────────────────────────────────────────────────────────
// Inter (the site's sans) read off disk at render time — not at module load: a
// top-level read runs when any importer's chunk is evaluated (e.g. prerendering a
// gallery page) and crashes there. The TTFs live in lib/og-fonts/ and are bundled
// into the OG functions by outputFileTracingIncludes in next.config.mjs — the same
// mechanism that ships the capture JSON the disk reads in lib/captures.ts need (nft
// can't follow these paths, so without the include they ENOENT on Vercel). Noto
// Sans is a glyph-coverage fallback, never selected directly. Memoized so a warm
// function reads each face once.
const SANS = "Inter"

type FontWeight = 400 | 600 | 700
type OgFont = {
  name: string
  data: Buffer
  weight: FontWeight
  style: "normal"
}

const fontsDir = join(process.cwd(), "lib/og-fonts")
let cachedFonts: OgFont[] | null = null
function loadFonts(): OgFont[] {
  if (!cachedFonts) {
    const read = (file: string) => readFileSync(join(fontsDir, file))
    cachedFonts = [
      {
        name: SANS,
        data: read("Inter-Regular.ttf"),
        weight: 400,
        style: "normal",
      },
      {
        name: SANS,
        data: read("Inter-SemiBold.ttf"),
        weight: 600,
        style: "normal",
      },
      {
        name: SANS,
        data: read("Inter-Bold.ttf"),
        weight: 700,
        style: "normal",
      },
      // Broad-coverage fallback for glyphs Inter lacks (extended Latin, Greek,
      // Cyrillic, symbols) so a non-Latin title renders text instead of tofu.
      {
        name: "Noto Sans",
        data: read("NotoSans-Regular.ttf"),
        weight: 400,
        style: "normal",
      },
    ]
  }
  return cachedFonts
}

function render(el: React.ReactElement) {
  return new ImageResponse(el, { ...ogSize, fonts: loadFonts() })
}

// ── Palette (mirrors the app's dark tokens) ──────────────────────────────────
const BG = "#0a0a0a" // --background  oklch(0.145 0 0)
const FG = "#fafafa" // --foreground
const MUTED = "#a1a1aa" // --muted-foreground (7.7:1 on BG)
const SURFACE = "#262626" // --card / --muted surface (flow +N tile)
const BORDER = "rgba(255,255,255,0.1)" // --border (white/10%)
// A 1px inset hairline so the near-black card keeps a defined edge on dark social
// surfaces (X/Slack dark mode) instead of bleeding into them.
const EDGE = "inset 0 0 0 1px rgba(255,255,255,0.07)"

const PHONE_RATIO = 1080 / 2400 // source screenshots are 9:20 portrait

// ── Color helpers ────────────────────────────────────────────────────────────
function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0")
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

// Deterministic two-color pair from a slug — in the family of the avatar.vercel.sh
// palette, used only if the avatar fetch fails so a card is never colorless.
function fallbackColors(slug: string): [string, string] {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  const hue = h % 360
  return [hslToHex(hue, 88, 52), hslToHex((hue + 150) % 360, 86, 46)]
}

// The app's brand colors = the two stops of its avatar.vercel.sh gradient (the
// .svg variant exposes them as `stop-color="#rrggbb"`). force-cache + the route's
// `revalidate = false` mean one fetch per app, ever.
async function brandColors(slug: string): Promise<[string, string]> {
  try {
    // Timeout so a stalled avatar service degrades to fallbackColors instead of
    // hanging the render to the function's max duration.
    const res = await fetch(`https://avatar.vercel.sh/${slug}.svg`, {
      cache: "force-cache",
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const svg = await res.text()
      const stops = [...svg.matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)].map(
        (m) => m[1]
      )
      if (stops.length >= 2) return [stops[0], stops[1]]
    }
  } catch {
    // fall through to the deterministic fallback
  }
  return fallbackColors(slug)
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function truncate(s: string, n: number): string {
  // Count + cut by code points ([...s]) not UTF-16 units, so a cut at a
  // surrogate-pair boundary (e.g. an emoji in a name) never splits a glyph.
  const cp = [...s]
  return cp.length > n ? `${cp.slice(0, n - 1).join("")}…` : s
}

async function imgDataUrl(
  slug: string,
  relPath: string | undefined
): Promise<string | null> {
  if (!relPath) return null
  try {
    const res = await fetch(`${assetBaseUrl}${captureUrl(slug, relPath)}`, {
      cache: "force-cache",
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:image/png;base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

// Background washes — the only place colour appears. Per-app cards get one soft
// radial of the app's brand hue; the home card a dual amber/teal radial.
function brandWash(c0: string): string {
  return `radial-gradient(1100px 760px at 88% -18%, ${rgba(c0, 0.1)}, transparent 64%)`
}
const HOME_WASH =
  "radial-gradient(1000px 720px at 14% -16%, rgba(249,172,6,0.08), transparent 60%), " +
  "radial-gradient(1000px 720px at 100% 116%, rgba(6,249,172,0.07), transparent 60%)"

// ── Shared pieces ─────────────────────────────────────────────────────────────

// The wallets.gallery mark (app/icon.svg — the Lucide "gallery" glyph that sits in
// the site header), stroked in `color`. Embedded as an SVG data URI; satori
// rasterizes it crisply. This is the SITE's mark, next to the wordmark — distinct
// from the per-app avatar mark.
function siteMarkUri(color: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' ` +
    `stroke='${color}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>` +
    `<path d='M7 2h10'/><path d='M5 6h14'/><rect width='18' height='12' x='3' y='10' rx='2'/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
function SiteMark({ size, color }: { size: number; color: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={siteMarkUri(color)} width={size} height={size} alt="" />
}

// The per-app avatar mark — the app's avatar.vercel.sh gradient, reconstructed from
// the parsed stops (pixel-sharp, identical to the site avatar). Flat, like the
// avatars in the app; radius follows the app's avatar rounding (~0.28 of size).
function BrandMark({ c0, c1, size }: { c0: string; c1: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundImage: `linear-gradient(135deg, ${c0}, ${c1})`,
      }}
    />
  )
}

// ── Type scale ────────────────────────────────────────────────────────────────
// One place for the shared text roles, so every card stays consistent (the rewrite
// was asked to keep fonts/weights uniform — these primitives make that structural).

// The display heading on every card: app name, screen/flow title, home wordmark.
// Tracking scales with size so the look is uniform across the 58–112px range.
function Title({
  size,
  marginTop,
  children,
}: {
  size: number
  marginTop?: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: -size * 0.035,
        lineHeight: 1.06,
        color: FG,
        marginTop,
      }}
    >
      {children}
    </div>
  )
}

// A muted metadata line (counts, capture dates).
function Meta({
  marginTop,
  children,
}: {
  marginTop?: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: SANS,
        fontSize: 24,
        color: MUTED,
        marginTop,
      }}
    >
      {children}
    </div>
  )
}

// The app-name eyebrow above a screen/flow title: the avatar mark + the app name.
function Eyebrow({ c0, c1, name }: { c0: string; c1: string; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
      <BrandMark c0={c0} c1={c1} size={46} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 31,
          color: MUTED,
        }}
      >
        {name}
      </div>
    </div>
  )
}

// The site wordmark lockup: the gallery icon + "wallets.gallery", set in Inter
// semibold like the in-app site header.
function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <SiteMark size={26} color={MUTED} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 25,
          letterSpacing: -0.2,
          color: MUTED,
        }}
      >
        wallets.gallery
      </div>
    </div>
  )
}

// A framed screenshot — flat like the app's tiles: rounded, white/10% border, a
// soft neutral drop shadow (no colour, no glow). Width follows the phone ratio.
function Shot({
  src,
  height,
  radius = 14,
}: {
  src: string
  height: number
  radius?: number
}) {
  const width = Math.round(height * PHONE_RATIO)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      style={{
        borderRadius: radius,
        objectFit: "cover",
        border: `1px solid ${BORDER}`,
        boxShadow: "0 12px 34px rgba(0,0,0,0.36)",
      }}
    />
  )
}

// A flow filmstrip tile's box — the missing-screenshot fallback, or the "+N" count
// of remaining screens. Same geometry as a `Shot` of the same height.
function StripTile({
  height,
  children,
}: {
  height: number
  children?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: Math.round(height * PHONE_RATIO),
        height,
        borderRadius: 10,
        backgroundColor: SURFACE,
        border: `1px solid ${BORDER}`,
      }}
    >
      {children}
    </div>
  )
}

// The shared canvas: near-black, the `backgroundImage` wash, and a 1px edge so it
// stays defined on dark surfaces. Every card's chrome lives here.
function Card({
  backgroundImage,
  children,
}: {
  backgroundImage: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: BG,
        backgroundImage,
        color: FG,
        fontFamily: SANS,
        overflow: "hidden",
        boxShadow: EDGE,
      }}
    >
      {children}
    </div>
  )
}

// A full-bleed centred column — the home and app card lockups sit in one of these.
function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  )
}

// ── Home / site card ─────────────────────────────────────────────────────────
export function siteOgImage() {
  return render(
    <Card backgroundImage={HOME_WASH}>
      <Center>
        <SiteMark size={80} color={FG} />
        <Title size={112} marginTop={30}>
          wallets.gallery
        </Title>
        <div
          style={{ display: "flex", fontSize: 36, color: MUTED, marginTop: 18 }}
        >
          A showcase of money apps curated by agents
        </div>
      </Center>
    </Card>
  )
}

// ── App card ─────────────────────────────────────────────────────────────────
export async function appOgImage(view: AppCapture, slug: string) {
  const [c0, c1] = await brandColors(slug)

  return render(
    <Card backgroundImage={brandWash(c0)}>
      {/* one centred lockup — the app, nothing else */}
      <Center>
        <BrandMark c0={c0} c1={c1} size={104} />
        <Title size={92} marginTop={36}>
          {truncate(view.app.name, 20)}
        </Title>
        <Meta marginTop={24}>
          {`${view.screens.length} screens  ·  ${view.flows.length} flows`}
        </Meta>
        <Meta marginTop={12}>
          {`Last captured ${formatDate(view.captureDate)}`}
        </Meta>
      </Center>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 52,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Wordmark />
      </div>
    </Card>
  )
}

// ── Screen card ──────────────────────────────────────────────────────────────
export async function screenOgImage(
  view: AppCapture,
  screen: ScreenEntry,
  slug: string
) {
  const [[c0, c1], src] = await Promise.all([
    brandColors(slug),
    imgDataUrl(slug, screen.screenshotPath),
  ])

  return render(
    <Card backgroundImage={brandWash(c0)}>
      {/* left: app eyebrow + screen title + meta */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 0,
          bottom: 0,
          width: 600,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Eyebrow c0={c0} c1={c1} name={view.app.name} />
        <Title size={58} marginTop={24}>
          {truncate(screen.title, 60)}
        </Title>
        <Meta marginTop={22}>{`Captured ${formatDate(view.captureDate)}`}</Meta>
      </div>

      <div
        style={{ position: "absolute", left: 80, bottom: 56, display: "flex" }}
      >
        <Wordmark />
      </div>

      {/* right: the screenshot, contained, fully visible */}
      {src && (
        <div
          style={{
            position: "absolute",
            right: 80,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Shot src={src} height={556} />
        </div>
      )}
    </Card>
  )
}

// ── Flow card ────────────────────────────────────────────────────────────────
export async function flowOgImage(
  view: AppCapture,
  flow: FlowEntry,
  slug: string
) {
  // Show up to MAX tiles; never more than the flow has. If there are more, the
  // last slot becomes a "+N" count of the remaining screens.
  const MAX = 4
  const total = flow.steps.length
  const showCount = total > MAX ? MAX - 1 : total
  const overflow = total > MAX ? total - showCount : 0
  const [[c0, c1], shots] = await Promise.all([
    brandColors(slug),
    Promise.all(
      flow.steps
        .slice(0, showCount)
        .map((s) => imgDataUrl(slug, s.screenshotPath))
    ),
  ])
  const stripHeight = 300

  return render(
    <Card backgroundImage={brandWash(c0)}>
      {/* header */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 70,
          right: 80,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Eyebrow c0={c0} c1={c1} name={view.app.name} />
        <Title size={58} marginTop={18}>
          {truncate(flow.name, 32)}
        </Title>
        <Meta marginTop={16}>
          {`${total} ${total === 1 ? "screen" : "screens"}  ·  Captured ${formatDate(view.captureDate)}`}
        </Meta>
      </div>

      {/* filmstrip — the first steps, flat like the in-app flow row */}
      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 58,
          display: "flex",
          alignItems: "flex-end",
          gap: 18,
        }}
      >
        {shots.map((shotSrc, i) =>
          shotSrc ? (
            <Shot key={i} src={shotSrc} height={stripHeight} radius={10} />
          ) : (
            <StripTile key={i} height={stripHeight} />
          )
        )}
        {overflow > 0 && (
          <StripTile height={stripHeight}>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: 42,
                color: MUTED,
              }}
            >
              {`+${overflow}`}
            </div>
          </StripTile>
        )}
      </div>

      <div
        style={{ position: "absolute", right: 80, bottom: 58, display: "flex" }}
      >
        <Wordmark />
      </div>
    </Card>
  )
}
