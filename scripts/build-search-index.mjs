import fs from "fs"
import path from "path"

const capturesDir = path.join(process.cwd(), "public/captures")
const outputPath = path.join(capturesDir, "search-index.json")

const entries = []

const dirs = fs.readdirSync(capturesDir, { withFileTypes: true })
for (const dir of dirs) {
  if (!dir.isDirectory()) continue
  const manifestPath = path.join(capturesDir, dir.name, "app.json")
  if (!fs.existsSync(manifestPath)) continue

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  const date = manifest.latestCapture
  const capturePath = path.join(capturesDir, dir.name, date, "capture.json")
  if (!fs.existsSync(capturePath)) continue

  const capture = JSON.parse(fs.readFileSync(capturePath, "utf-8"))
  const appSlug = manifest.app.slug
  const appName = manifest.app.name

  entries.push({
    type: "app",
    appSlug,
    appName,
    label: appName,
    description: `${manifest.app.platform.toUpperCase()} app — ${capture.screens.length} screens, ${capture.flows.length} flows`,
    href: `/apps/${appSlug}`,
  })

  for (const screen of capture.screens) {
    entries.push({
      type: "screen",
      appSlug,
      appName,
      label: screen.title || screen.id,
      description: screen.description,
      screenId: screen.id,
      href: `/apps/${appSlug}/screens/${screen.id}`,
    })
  }

  for (const flow of capture.flows) {
    entries.push({
      type: "flow",
      appSlug,
      appName,
      label: flow.name,
      description: flow.summary,
      flowSlug: flow.slug,
      href: `/apps/${appSlug}/flows/${flow.slug}`,
    })

    for (const step of flow.steps) {
      entries.push({
        type: "step",
        appSlug,
        appName,
        label: step.title,
        description: step.description,
        flowSlug: flow.slug,
        flowName: flow.name,
        screenId: step.screenId,
        href: `/apps/${appSlug}/flows/${flow.slug}`,
      })
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
console.log(`Generated search index with ${entries.length} entries`)
