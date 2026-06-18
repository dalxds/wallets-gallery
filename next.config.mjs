/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel-native: the gallery is prerendered (SSG) at build, but screen/flow
  // pages + their OG images render on demand and cache, and next/image is
  // optimized on demand by Vercel's image CDN. (Was output:"export" — dropped in
  // 0.2.0 to enable per-screen/flow share cards and image optimization.)
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
