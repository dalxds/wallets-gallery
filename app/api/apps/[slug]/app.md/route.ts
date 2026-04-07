import fs from "fs"
import path from "path"
import { NextRequest } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const indexPath = path.join(
    process.cwd(),
    "public/captures/index.json"
  )
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"))

  const app = index.apps.find(
    (a: { slug: string }) => a.slug === slug
  )
  if (!app) {
    return new Response("App not found", { status: 404 })
  }

  const date =
    request.nextUrl.searchParams.get("date") ?? app.latest

  const mdPath = path.join(
    process.cwd(),
    "public/captures",
    slug,
    date,
    "app.md"
  )

  try {
    const content = fs.readFileSync(mdPath, "utf-8")
    return new Response(content, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    })
  } catch {
    return new Response("Capture not found", { status: 404 })
  }
}
