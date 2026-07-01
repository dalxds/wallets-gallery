import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { captureUrl } from "@/lib/images"
import { assetBaseUrl } from "@/lib/site"
import { formatDate } from "@/lib/utils"
import type { AppCapture, FlowEntry, ScreenEntry } from "@/lib/types"

// Shared Open Graph card renderers (1200×630) for the site, app, screen, and flow
// routes. Server-only (Node runtime). The look mirrors the app itself: a flat
// near-black card (the app's dark `--background`), Inter at the app's weights,
// white/10% borders, the app's corner radii, and screenshots framed flat like the
// in-app tiles. Per-app cards carry no colour — no wash, no gradient text or glow;
// only the home card keeps a fixed amber/teal wash.
// Two kinds of image are fetched at render time and embedded into the satori card:
//   • screenshot PNGs — FETCHED from the CDN (static assets in public/) and inlined
//     as base64. Fetching over HTTP keeps these functions code-only: no image bytes
//     traced into the lambda (wouldn't scale to ~50k screenshots). Content-addressed
//     assets are immutable, so force-cache composites each shot at most once.
//   • the app mark — its committed logo.png if it has one, else the generated
//     avatar.vercel.sh avatar (the same mark the site shows). Both are fetched +
//     force-cached and inlined; a neutral box covers a miss.

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

// The home card's fixed amber/teal wash — the only place colour appears now.
// Per-app cards are flat (no brand wash): a real logo has no cheap representative
// hue to derive, so cards carry none rather than guess one.
const HOME_WASH =
  "radial-gradient(1000px 720px at 14% -16%, rgba(249,172,6,0.08), transparent 60%), " +
  "radial-gradient(1000px 720px at 100% 116%, rgba(6,249,172,0.07), transparent 60%)"

// The card's app mark, inlined as a data URI: the committed logo.png if the app has
// one, else the generated avatar.vercel.sh avatar (svg) — the same mark the site
// shows. Both are force-cached (one fetch per app, ever, given the route's
// `revalidate = false`); null when both fetches fail (the mark renders a neutral
// box instead, so a card is never markless).
async function markDataUrl(
  slug: string,
  logo: string | null
): Promise<string | null> {
  if (logo) {
    const url = await imgDataUrl(slug, logo)
    if (url) return url
  }
  try {
    // Timeout so a stalled avatar service degrades to the neutral box instead of
    // hanging the render to the function's max duration.
    const res = await fetch(`https://avatar.vercel.sh/${slug}.svg`, {
      cache: "force-cache",
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const svg = await res.text()
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
    }
  } catch {
    // fall through to the neutral box
  }
  return null
}

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

// The per-app mark — the app's logo/avatar image, inlined via markDataUrl. Flat,
// like the avatars in the app; radius follows the app's avatar rounding (~0.28 of
// size), object-cover so a non-square logo isn't distorted. A neutral surface box
// stands in when the image is missing so a card is never markless.
function Mark({ src, size }: { src: string | null; size: number }) {
  const borderRadius = Math.round(size * 0.28)
  if (!src)
    return (
      <div
        style={{
          display: "flex",
          width: size,
          height: size,
          borderRadius,
          backgroundColor: SURFACE,
        }}
      />
    )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ borderRadius, objectFit: "cover" }}
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

// The app-name eyebrow above a screen/flow title: the app mark + the app name.
function Eyebrow({ mark, name }: { mark: string | null; name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
      <Mark src={mark} size={46} />
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
  // Omitted on per-app cards (flat near-black); set only by the home card (wash).
  backgroundImage?: string
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
        // Only set when a wash is passed (home card). satori calls .trim() on the
        // backgroundImage value, so a literal `undefined` here crashes the render —
        // omit the key entirely on the flat per-app cards.
        ...(backgroundImage ? { backgroundImage } : {}),
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
          a showcase of money apps curated by agents
        </div>
      </Center>
    </Card>
  )
}

// ── App card ─────────────────────────────────────────────────────────────────
export async function appOgImage(
  view: AppCapture,
  slug: string,
  logo: string | null
) {
  const mark = await markDataUrl(slug, logo)

  return render(
    <Card>
      {/* one centred lockup — the app, nothing else */}
      <Center>
        <Mark src={mark} size={104} />
        <Title size={92} marginTop={36}>
          {truncate(view.app.name, 20)}
        </Title>
        <Meta marginTop={24}>
          {`${view.screens.length} screens  ·  ${view.flows.length} flows`}
        </Meta>
        <Meta marginTop={12}>
          {`Captured on ${formatDate(view.captureDate)}`}
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
  slug: string,
  logo: string | null
) {
  const [mark, src] = await Promise.all([
    markDataUrl(slug, logo),
    imgDataUrl(slug, screen.screenshotPath),
  ])

  return render(
    <Card>
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
        <Eyebrow mark={mark} name={view.app.name} />
        <Title size={58} marginTop={24}>
          {truncate(screen.title, 60)}
        </Title>
        <Meta marginTop={22}>{`Captured on ${formatDate(view.captureDate)}`}</Meta>
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
  slug: string,
  logo: string | null
) {
  // Show up to MAX tiles; never more than the flow has. If there are more, the
  // last slot becomes a "+N" count of the remaining screens.
  const MAX = 4
  const total = flow.steps.length
  const showCount = total > MAX ? MAX - 1 : total
  const overflow = total > MAX ? total - showCount : 0
  const [mark, shots] = await Promise.all([
    markDataUrl(slug, logo),
    Promise.all(
      flow.steps
        .slice(0, showCount)
        .map((s) => imgDataUrl(slug, s.screenshotPath))
    ),
  ])
  const stripHeight = 300

  return render(
    <Card>
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
        <Eyebrow mark={mark} name={view.app.name} />
        <Title size={58} marginTop={18}>
          {truncate(flow.name, 32)}
        </Title>
        <Meta marginTop={16}>
          {`${total} ${total === 1 ? "screen" : "screens"}  ·  Captured on ${formatDate(view.captureDate)}`}
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
