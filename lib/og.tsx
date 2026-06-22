import { ImageResponse } from "next/og"
import { assetBaseUrl } from "@/lib/site"
import type { AppCapture, FlowEntry, ScreenEntry } from "@/lib/types"

// Shared Open Graph card renderers (1200×630) for the site, app, screen, and flow
// routes. Server-only: FETCHES the content-addressed PNGs from the CDN (they're
// served as static assets from public/) and embeds them as base64 into the
// satori-rendered card. Fetching over HTTP — rather than readFileSync from the
// function bundle — keeps these on-demand functions code-only: no image bytes are
// traced into the lambda (which wouldn't scale to ~50k screenshots). The
// content-addressed assets are immutable, so force-cache makes each card composite
// its screenshots at most once. ImageResponse uses next/og's default font, so no
// font files are shipped.

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = "image/png"

const BG = "#0a0a0a"
const FG = "#fafafa"
const MUTED = "#a1a1aa"

async function imgDataUrl(
  slug: string,
  relPath: string | undefined
): Promise<string | null> {
  if (!relPath) return null
  try {
    const res = await fetch(`${assetBaseUrl}/captures/${slug}/${relPath}`, {
      cache: "force-cache",
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:image/png;base64,${buf.toString("base64")}`
  } catch {
    return null
  }
}

function coverPath(view: AppCapture): string | undefined {
  const withShot = view.screens.filter((s) => s.screenshotPath)
  return (withShot.find((s) => s.role === "home") ?? withShot[0])
    ?.screenshotPath
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

const shot = {
  borderRadius: 24,
  objectFit: "cover" as const,
  border: "1px solid #27272a",
}

export function siteOgImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        background: BG,
        color: FG,
        padding: 80,
      }}
    >
      <div style={{ fontSize: 80, fontWeight: 700 }}>Wallets Gallery</div>
      <div style={{ fontSize: 34, color: MUTED, marginTop: 18 }}>
        Captured UI flows from crypto wallets and fintech apps
      </div>
    </div>,
    ogSize
  )
}

export async function appOgImage(view: AppCapture, slug: string) {
  const cover = await imgDataUrl(slug, coverPath(view))
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        background: BG,
        color: FG,
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          paddingRight: 48,
        }}
      >
        <div style={{ fontSize: 30, color: MUTED }}>Wallets Gallery</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 12 }}>
          {view.app.name}
        </div>
        <div style={{ fontSize: 34, color: MUTED, marginTop: 24 }}>
          {`${view.screens.length} screens · ${view.flows.length} flows`}
        </div>
        <div style={{ fontSize: 26, color: MUTED, marginTop: 8 }}>
          {view.app.platform.toUpperCase()}
        </div>
      </div>
      {cover && (
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" width={236} height={502} style={shot} />
        </div>
      )}
    </div>,
    ogSize
  )
}

export async function screenOgImage(
  view: AppCapture,
  screen: ScreenEntry,
  slug: string
) {
  const src = await imgDataUrl(slug, screen.screenshotPath)
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        background: BG,
        color: FG,
        padding: 64,
      }}
    >
      {src && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginRight: 56,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" width={236} height={502} style={shot} />
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
        }}
      >
        <div style={{ fontSize: 30, color: MUTED }}>{view.app.name}</div>
        <div style={{ fontSize: 58, fontWeight: 700, marginTop: 12 }}>
          {truncate(screen.title, 60)}
        </div>
        {screen.description && (
          <div style={{ fontSize: 30, color: MUTED, marginTop: 20 }}>
            {truncate(screen.description, 120)}
          </div>
        )}
      </div>
    </div>,
    ogSize
  )
}

export async function flowOgImage(
  view: AppCapture,
  flow: FlowEntry,
  slug: string
) {
  const shots = (
    await Promise.all(
      flow.steps.slice(0, 4).map((s) => imgDataUrl(slug, s.screenshotPath))
    )
  ).filter((s): s is string => s !== null)
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        background: BG,
        color: FG,
        padding: 56,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 28, color: MUTED }}>
          {`${view.app.name} · flow`}
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, marginTop: 8 }}>
          {truncate(flow.name, 50)}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 20,
          marginTop: 24,
        }}
      >
        {shots.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" width={170} height={362} style={shot} />
        ))}
      </div>
    </div>,
    ogSize
  )
}
