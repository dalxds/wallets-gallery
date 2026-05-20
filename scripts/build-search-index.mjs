import fs from "fs"
import path from "path"

const capturesDir = path.join(process.cwd(), "public/captures")
const indexPath = path.join(capturesDir, "index.json")
const outputPath = path.join(capturesDir, "search-index.json")

const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"))
const entries = []

for (const app of index.apps) {
  const date = app.latest
  const appDir = path.join(capturesDir, app.slug, date)
  const appJson = JSON.parse(
    fs.readFileSync(path.join(appDir, "app.json"), "utf-8")
  )

  // App entry
  entries.push({
    type: "app",
    appSlug: app.slug,
    appName: appJson.app.name,
    label: appJson.app.name,
    description: `${appJson.app.platform.toUpperCase()} app — ${appJson.screens.length} screens, ${appJson.flows.length} flows`,
    href: `/apps/${app.slug}`,
  })

  // Screen entries
  for (const screen of appJson.screens) {
    entries.push({
      type: "screen",
      appSlug: app.slug,
      appName: appJson.app.name,
      label: screen.id,
      description: screen.description,
      screenId: screen.id,
      href: `/apps/${app.slug}/screens/${screen.id}`,
    })
  }

  // Flow entries
  for (const flow of appJson.flows) {
    entries.push({
      type: "flow",
      appSlug: app.slug,
      appName: appJson.app.name,
      label: flow.name,
      description: flow.summary,
      flowSlug: flow.slug,
      href: `/apps/${app.slug}/flows/${flow.slug}`,
    })

    // Flow step entries
    for (const step of flow.steps) {
      entries.push({
        type: "step",
        appSlug: app.slug,
        appName: appJson.app.name,
        label: step.title,
        description: step.description,
        flowSlug: flow.slug,
        flowName: flow.name,
        screenId: step.screenId,
        href: `/apps/${app.slug}/flows/${flow.slug}`,
      })
    }
  }
}

fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2))
console.log(`Generated search index with ${entries.length} entries`)
