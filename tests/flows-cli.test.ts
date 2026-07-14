import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

describe("flows validate CLI", () => {
  let directory = ""
  let graphPath = ""

  beforeAll(() => {
    directory = mkdtempSync(join(tmpdir(), "wallets-gallery-flows-"))
    graphPath = join(directory, "graph.json")
    writeFileSync(
      graphPath,
      JSON.stringify({
        meta: {
          schemaVersion: 2,
          app: {
            name: "Demo",
            slug: "demo",
            bundleId: "com.demo",
            platform: "android",
          },
          captureDate: "2026-07-14",
          scope: "initial",
          mode: "guided",
          previousCapture: null,
        },
        root: "home",
        nodes: [
          {
            id: "home",
            fingerprint: "sha256:home",
            skeletonHash: "sk:home",
            pHash: null,
            role: "home",
            screenshotPath: "assets/home.png",
            snapshotPath: null,
            texts: ["Home"],
            interactiveElements: [],
          },
        ],
        edges: [],
        decisionPoints: [],
        overrides: {},
      })
    )
  })

  afterAll(() => rmSync(directory, { recursive: true, force: true }))

  function validate(flows: unknown, strict = false) {
    const flowsPath = join(directory, strict ? "strict.json" : "flows.json")
    writeFileSync(flowsPath, JSON.stringify(flows))
    return spawnSync(
      process.execPath,
      [
        "scripts/flows.ts",
        "validate",
        graphPath,
        flowsPath,
        ...(strict ? ["--strict"] : []),
      ],
      { cwd: process.cwd(), encoding: "utf8" }
    )
  }

  it("exits non-zero for hard errors without --strict", () => {
    const result = validate({
      schemaVersion: 1,
      flows: [
        {
          id: "home",
          name: "Home",
          parentId: null,
          order: 0,
          steps: ["missing"],
        },
      ],
      uncovered: {},
      flowTODO: [],
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('error: flow "home", step 1')
  })

  it("uses --strict only to escalate non-empty flowTODO", () => {
    const flows = {
      schemaVersion: 1,
      flows: [
        {
          id: "home",
          name: "Home",
          parentId: null,
          order: 0,
          steps: ["home"],
        },
      ],
      uncovered: {},
      flowTODO: [{ about: "home", question: "Check wording?" }],
    }

    expect(validate(flows).status).toBe(0)
    expect(validate(flows, true).status).toBe(1)
  })
})
