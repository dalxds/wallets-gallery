import fs from "fs"
import path from "path"

// Read the registry once at config eval (build time), the same way the llms.txt
// route does — used to bake the per-app "latest" data redirects below.
const captures = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/captures/index.json"), "utf-8")
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel-native: the gallery is prerendered (SSG) at build, but screen/flow
  // pages + their OG images render on demand and cache, and next/image is
  // optimized on demand by Vercel's image CDN. (Was output:"export" — dropped in
  // 1.0.0 to enable per-screen/flow share cards and image optimization.)
  images: {
    // AVIF preferred, WebP fallback. Each format is cached separately.
    formats: ["image/avif", "image/webp"],
    // Only the widths we actually render. Screens are 1080×2400 portrait.
    // imageSizes (grid thumbs + filmstrip) must all be < min(deviceSizes).
    imageSizes: [128, 200, 256, 384],
    // deviceSizes: the lightbox/standalone stage. Trimmed hard to cap the number
    // of transformations billed (one variant per width × format × quality).
    deviceSizes: [640, 828, 1080],
    // Required in Next 16. A single value keeps the cache-key matrix minimal.
    qualities: [70],
    // 1 year. Safe because screenshot filenames are content hashes — new content
    // is a new URL, so a long TTL never serves stale.
    minimumCacheTTL: 31536000,
    // Lock optimization to our screenshots (search:"" = no query allowed).
    localPatterns: [{ pathname: "/captures/**", search: "" }],
    // App avatars (we render these unoptimized, but allow the host just in case).
    remotePatterns: [{ protocol: "https", hostname: "avatar.vercel.sh", pathname: "/**", search: "" }],
  },
  // On-demand /apps routes (non-prebuilt screen/flow pages, dated galleries, and
  // the OG cards) read the generated index.json / view.json off disk at request
  // time (lib/captures.ts). These MUST be disk reads — generateStaticParams + SSG
  // run at build, before any deploy exists to fetch from. But the read paths are
  // dynamic (slug/date), which Next's static file tracing can't follow, so it
  // conservatively globs the ENTIRE public/captures tree into every function. Pin
  // it down so the functions stay small and scale to ~50k screenshots:
  //  • include — guarantee the small JSON the runtime actually reads is bundled
  //    (without it the reads ENOENT on Vercel; works under `next start`, which has
  //    the full tree on disk);
  //  • exclude — keep the screenshot PNGs (and the raw graph.json / _staging
  //    snapshots nft over-pulls) OUT of the bundles. Bundling every PNG would blow
  //    the 250 MB function limit and is needless: the OG cards fetch screenshots
  //    from the CDN (lib/og.tsx) and the browser/optimizer serve them from public/.
  // The OG functions also read the site's TTF fonts off disk (lib/og.tsx); bundle
  // lib/og-fonts so they're present. (nft already auto-traces these from the
  // readFileSync(...".ttf") literals, so every route — page lambdas included —
  // carries the ~1.5 MB regardless; a narrower include key doesn't change that, so
  // this just guarantees the OG functions have them.)
  outputFileTracingIncludes: {
    "/apps/**": [
      "./public/captures/index.json",
      "./public/captures/**/view.json",
      "./lib/og-fonts/*.ttf",
    ],
    "/opengraph-image": ["./lib/og-fonts/*.ttf"],
  },
  outputFileTracingExcludes: {
    "/apps/**": [
      "./public/captures/**/*.png",
      "./public/captures/**/graph.json",
      "./public/captures/**/*.snap.json",
    ],
  },
  // /captures/<slug>/latest/{view,graph}.json — a stable, date-free data entry
  // point for consumers (agents, the MCP/skill), mirroring the /apps/<slug> →
  // /apps/<slug>/<latest> HTML redirect on the data side. We bake one redirect
  // per known app from index.json (regenerated on every build, so it tracks
  // app.latest); an unknown slug matches no source and falls through to a normal
  // 404. permanent:false → 307, NOT 308: "latest" moves when a newer capture
  // lands, so the redirect must never be cached as permanent. The dated files are
  // untouched — they stay the immutable, long-cacheable canonical URLs; this is
  // only an alias that saves consumers the index.json round-trip to resolve the
  // date. (Screenshot paths in view.json are app-relative — /captures/<slug>/… —
  // and live above the date dirs, so the alias never affects how they resolve.)
  async redirects() {
    return captures.apps.flatMap((app) =>
      ["view.json", "graph.json"].map((file) => ({
        source: `/captures/${app.slug}/latest/${file}`,
        destination: `/captures/${app.slug}/${app.latest}/${file}`,
        permanent: false,
      }))
    )
  },
  // The content-addressed PNGs are immutable — cache the originals forever. This
  // also lengthens the optimized variants' TTL (the larger of this vs
  // minimumCacheTTL wins).
  async headers() {
    return [
      {
        source: "/captures/:slug/assets/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ]
  },
  // Dev-only: allow loading /_next/* when you open the dev server from another
  // device on the LAN (e.g. a phone hitting the Mac's IP). Add origins as needed.
  allowedDevOrigins: ["192.168.1.11"],
}

export default nextConfig
