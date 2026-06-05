/** @type {import('next').NextConfig} */
const nextConfig = {
  // The gallery is fully derivable at build time (registry + per-capture
  // view.json under public/captures), so the whole site exports to static
  // HTML in `out/` and can be served from any CDN — no Node server at runtime.
  output: "export",
  // next/image's default loader needs a server; we render plain <img> against
  // the content-addressed PNGs in public/, so opt out of optimization.
  images: { unoptimized: true },
}

export default nextConfig
