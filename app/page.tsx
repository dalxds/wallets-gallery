import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { AppsRegistry } from "@/lib/types"
import { BrowseClient } from "./browse-client"

// Read the registry at build time and prerender the gallery into static HTML.
// index.json now carries per-app covers + counts, so the browse page needs
// nothing else — no per-app view.json fetches.
export default function BrowsePage() {
  const indexPath = join(process.cwd(), "public/captures/index.json")
  const registry = JSON.parse(readFileSync(indexPath, "utf8")) as AppsRegistry
  return <BrowseClient apps={registry.apps} />
}
