/** @type {import('next').NextConfig} */
const nextConfig = {
  // The gallery is fully derivable at build time (registry + per-capture
  // view.json under public/captures), so the whole site exports to static
  // HTML in `out/` and can be served from any CDN — no Node server at runtime.
  output: "export",
  // next/image's default loader needs a server; we render plain <img> against
  // the content-addressed PNGs in public/, so opt out of optimization.
  images: { unoptimized: true },
  // Dev-only: allow loading /_next/* when you open the dev server from another
  // device on the LAN (e.g. a phone hitting the Mac's IP). Ignored in the
  // static export. Add more origins/IPs here as needed.
  allowedDevOrigins: ["192.168.1.11"],
}

export default nextConfig
