// Post-export prune (runs after `next build` with output: "export").
//
// `output: export` copies the ENTIRE public/ tree into out/ with no exclude
// hook. Capture directories carry build-time intermediates and secrets that are
// git-ignored but still physically present under public/captures — so without
// this step they would ship in the published static bundle:
//
//   • _staging/        — raw pre-assembly screenshots/snapshots + walk.json
//                        (already content-addressed into assets/; dead weight)
//   • credentials.md   — per-capture test-account login notes
//   • *.bak            — editor/agent backups
//
// This denylist mirrors the "captures" section of .gitignore exactly — the
// repo's single source of truth for "not part of the published site". We prune
// out/ only; public/ (the working tree) is never touched.

import { readdirSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"

const outCaptures = join(process.cwd(), "out", "captures")

const removed: string[] = []

function prune(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "_staging") {
        rmSync(full, { recursive: true, force: true })
        removed.push(`${full}/`)
        continue
      }
      prune(full)
    } else if (entry.name === "credentials.md" || entry.name.endsWith(".bak")) {
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
