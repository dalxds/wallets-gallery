import { captureUrl } from "@/lib/images"

// The mark shown for an app anywhere in the UI: its committed brand logo when one
// exists (public/captures/<slug>/logo.png, carried on AppIndex.logo as an
// app-relative path), otherwise the generated avatar.vercel.sh avatar. Pure and
// isomorphic (no node:fs) so it's safe in client components — the OG renderer has
// its own byte-inlining path in lib/og.tsx and does NOT use this.
export function appAvatarSrc(
  slug: string,
  logo: string | null | undefined
): string {
  return logo ? captureUrl(slug, logo) : `https://avatar.vercel.sh/${slug}`
}
