export function captureUrl(
  slug: string,
  date: string,
  relativePath: string
): string {
  return `/captures/${slug}/${date}/${relativePath}`
}
