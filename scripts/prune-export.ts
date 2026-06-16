// Post-export prune (runs after `next build` with output: "export").
//
// `output: export` copies the ENTIRE public/ tree into out/ with no exclude
// hook. Capture directories carry build-time intermediates and secrets that are
// git-ignored but still physically present under public/captures — so without
// this step they would ship in the published static bundle.
//
// This is an ALLOWLIST, leak-proof by default: the published site needs only the
// JSON data (index / app / graph / view + *.snap.json) and the
// content-addressed PNG screenshots. EVERYTHING else under out/captures is
// removed — _staging/, credentials.md, *.bak, and any stray .DS_Store / *.pem /
// .env*.local. (The previous denylist had to be hand-synced with .gitignore and
// silently shipped whatever it forgot.) We prune out/ only; public/ (the working
// tree) is never touched.

import { readdirSync, rmSync, statSync } from "node:fs"
import { join, extname } from "node:path"

const outCaptures = join(process.cwd(), "out", "captures")

// Extensions that ARE the published site (".snap.json" ends in ".json").
const KEEP_EXT = new Set([".json", ".png"])

const removed: string[] = []

function prune(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // _staging is never published; drop the whole subtree without recursing.
      if (entry.name === "_staging") {
        rmSync(full, { recursive: true, force: true })
        removed.push(`${full}/`)
        continue
      }
      prune(full)
    } else if (!KEEP_EXT.has(extname(entry.name).toLowerCase())) {
      rmSync(full, { force: true })
      removed.push(full)
    }
  }
}

try {
  statSync(outCaptures)
} catch {
  console.error("prune-export: out/captures not found — did `next build` run with output: export?")
  process.exit(0)
}

prune(outCaptures)

if (removed.length) {
  console.log(`prune-export: removed ${removed.length} build-time artifact(s) from out/captures:`)
  for (const p of removed) console.log(`  - ${p.replace(process.cwd() + "/", "")}`)
} else {
  console.log("prune-export: nothing to prune")
}
