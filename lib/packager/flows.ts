// Semantic flow source canonicalization, validation, audit aggregation, and
// mechanical migration. Grouping, naming, and parent placement are never inferred.

import type {
  FlowDefinition,
  FlowsFile,
  Graph,
} from "./types.ts"
import { buildInventory, projectGraph, type ProjectedGraph } from "./project.ts"
import { screenTitle } from "./naming.ts"
import { validateGraph, type ValidationResult } from "./validate.ts"
import { variationParam } from "../variations.ts"

export interface ReferenceMigration {
  location: string
  from: string
  to: string
}

export interface MigratedFlows {
  flows: FlowsFile
  canonicalizations: ReferenceMigration[]
  warnings: string[]
}

export interface FlowValidationResult extends ValidationResult {
  canonicalizations: ReferenceMigration[]
  coverage: {
    covered: string[]
    uncovered: Record<string, string>
    unaccounted: string[]
  }
}

export interface AuditedFlowPackage {
  key: string
  graph: Graph
  flows: FlowsFile
}

export interface FlowAuditReport {
  packages: {
    key: string
    errors: string[]
    warnings: string[]
    canonicalizations: ReferenceMigration[]
    screenCanonicalizations: { from: string; to: string }[]
    derivationGroups: { id: string; members: { id: string; label: string }[] }[]
    coverage: FlowValidationResult["coverage"]
  }[]
  totals: {
    packages: number
    errors: number
    warnings: number
    canonicalizations: number
    screenCanonicalizations: number
    derivationGroups: number
    covered: number
    uncovered: number
    unaccounted: number
  }
}

const FLOW_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CAMEL_CASE_TOKEN = /^[a-z]{2,}(?:[A-Z][a-z0-9]*)+$/

function hasMachineCamelCase(value: string): boolean {
  return value.split(/\s+/).some((raw) => {
    const token = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    return CAMEL_CASE_TOKEN.test(token)
  })
}

function canonicalReference(projected: ProjectedGraph, id: string): string | null {
  if (projected.canonicalOf.has(id)) return projected.canonicalOf.get(id)!
  return projected.nodeById.has(id) ? id : null
}

export function migrateFlows(graph: Graph, source: FlowsFile): MigratedFlows {
  const projected = projectGraph(graph)
  const canonicalizations: ReferenceMigration[] = []
  const warnings: string[] = []
  const flows = [...(source.flows ?? [])].map((flow) => {
    const steps: string[] = []
    for (let index = 0; index < (flow.steps ?? []).length; index++) {
      const raw = flow.steps[index]
      const canonical = canonicalReference(projected, raw) ?? raw
      if (canonical !== raw) {
        canonicalizations.push({
          location: `flows.${flow.id}.steps[${index}]`,
          from: raw,
          to: canonical,
        })
      }
      if (steps.at(-1) !== canonical) steps.push(canonical)
    }
    const entryPoints = flow.entryPoints?.map((entry, index) => {
      const fromScreenId = canonicalReference(projected, entry.fromScreenId) ?? entry.fromScreenId
      const toScreenId = canonicalReference(projected, entry.toScreenId) ?? entry.toScreenId
      for (const [field, raw, canonical] of [
        ["fromScreenId", entry.fromScreenId, fromScreenId],
        ["toScreenId", entry.toScreenId, toScreenId],
      ] as const) {
        if (canonical !== raw) {
          canonicalizations.push({
            location: `flows.${flow.id}.entryPoints[${index}].${field}`,
            from: raw,
            to: canonical,
          })
        }
      }
      return { ...entry, fromScreenId, toScreenId }
    })
    return {
      ...flow,
      steps,
      ...(entryPoints ? { entryPoints } : {}),
    }
  })

  const uncoveredCandidates = new Map<string, { raw: string; reason: string }[]>()
  for (const raw of Object.keys(source.uncovered ?? {}).sort()) {
    const canonical = canonicalReference(projected, raw) ?? raw
    if (canonical !== raw) {
      canonicalizations.push({
        location: `uncovered.${raw}`,
        from: raw,
        to: canonical,
      })
    }
    const candidates = uncoveredCandidates.get(canonical) ?? []
    candidates.push({ raw, reason: source.uncovered[raw] })
    uncoveredCandidates.set(canonical, candidates)
  }
  const uncovered: Record<string, string> = {}
  for (const [canonical, candidates] of [...uncoveredCandidates].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    const reasons = [...new Set(candidates.map((candidate) => candidate.reason))]
    uncovered[canonical] = reasons.join("; ")
    if (candidates.length > 1)
      warnings.push(
        `uncovered "${canonical}" combines canonicalized entries ${candidates
          .map((candidate) => `"${candidate.raw}" ("${candidate.reason}")`)
          .join(", ")}`
      )
  }

  canonicalizations.sort((a, b) => {
    if (a.location !== b.location) return a.location < b.location ? -1 : 1
    if (a.from !== b.from) return a.from < b.from ? -1 : 1
    return a.to < b.to ? -1 : a.to > b.to ? 1 : 0
  })

  return {
    flows: {
      ...source,
      schemaVersion: source.schemaVersion,
      flows,
      uncovered,
      flowTODO: [...(source.flowTODO ?? [])],
    },
    canonicalizations,
    warnings: warnings.sort(),
  }
}

function orderedTree(flows: FlowDefinition[]): FlowDefinition[] {
  const byParent = new Map<string | null, FlowDefinition[]>()
  for (const flow of flows) {
    const siblings = byParent.get(flow.parentId) ?? []
    siblings.push(flow)
    byParent.set(flow.parentId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
  const ordered: FlowDefinition[] = []
  const seen = new Set<string>()
  const visit = (parent: string | null) => {
    for (const flow of byParent.get(parent) ?? []) {
      if (seen.has(flow.id)) continue
      seen.add(flow.id)
      ordered.push(flow)
      visit(flow.id)
    }
  }
  visit(null)
  return ordered
}

export function orderFlows(source: FlowsFile): FlowDefinition[] {
  return orderedTree(source.flows)
}

export function validateFlows(
  graph: Graph,
  source: FlowsFile,
  options: { strict?: boolean } = {}
): FlowValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const error = (message: string) => errors.push(message)
  const warning = (message: string) => warnings.push(message)
  let malformed = false

  if (source?.schemaVersion !== 1)
    error(`schemaVersion must be 1, got ${source?.schemaVersion}`)
  if (!Array.isArray(source?.flows)) {
    error("flows must be an array")
    malformed = true
  }
  if (!source?.uncovered || Array.isArray(source.uncovered) || typeof source.uncovered !== "object") {
    error("uncovered must be an object")
    malformed = true
  }
  if (!Array.isArray(source?.flowTODO)) {
    error("flowTODO must be an array")
    malformed = true
  }

  if (Array.isArray(source?.flows)) {
    for (let index = 0; index < source.flows.length; index++) {
      const flow = source.flows[index]
      if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
        error(`flows[${index}] must be an object`)
        malformed = true
        continue
      }
      const context = `flows[${index}] (${flow.id ?? "?"})`
      if (!Array.isArray(flow.steps)) {
        error(`${context}: steps must contain at least one local screen`)
        malformed = true
      }
      if (flow.entryPoints != null && !Array.isArray(flow.entryPoints)) {
        error(`${context}: entryPoints must be an array when present`)
        malformed = true
      }
      if (Array.isArray(flow.entryPoints)) {
        for (let entryIndex = 0; entryIndex < flow.entryPoints.length; entryIndex++) {
          const entry = flow.entryPoints[entryIndex]
          if (
            !entry ||
            typeof entry !== "object" ||
            typeof entry.flowId !== "string" ||
            typeof entry.fromScreenId !== "string" ||
            typeof entry.toScreenId !== "string"
          ) {
            error(
              `${context}: entryPoints[${entryIndex}] must name flowId, fromScreenId, and toScreenId`
            )
            malformed = true
          }
        }
      }
    }
  }

  if (malformed) {
    return {
      errors: [...new Set(errors)].sort(),
      warnings: [],
      canonicalizations: [],
      coverage: { covered: [], uncovered: {}, unaccounted: [] },
    }
  }

  const projected = projectGraph(graph)
  const migrated = migrateFlows(graph, source)
  const flowsFile = migrated.flows

  const ids = new Set<string>()
  for (let index = 0; index < (source?.flows ?? []).length; index++) {
    const flow = source.flows[index]
    const context = `flows[${index}] (${flow?.id ?? "?"})`
    if (!flow?.id || !FLOW_ID.test(flow.id)) error(`${context}: id must be human-readable kebab-case`)
    else if (ids.has(flow.id)) error(`${context}: duplicate id`)
    else ids.add(flow.id)
    if (!flow?.name?.trim()) error(`${context}: name must be non-empty`)
    else if (hasMachineCamelCase(flow.name))
      error(`${context}: name must use spaced words, not camel/Pascal-case text ("${flow.name}")`)
    if (!("parentId" in (flow ?? {}))) error(`${context}: parentId must be explicit`)
    else if (flow.parentId !== null && typeof flow.parentId !== "string")
      error(`${context}: parentId must be a flow id or null`)
    if (!Number.isInteger(flow?.order)) error(`${context}: order must be an integer`)
    if (flow.steps.length === 0)
      error(`${context}: steps must contain at least one local screen`)
    if (flow?.summary != null && typeof flow.summary !== "string")
      error(`${context}: summary must be a string when present`)
    for (let entryIndex = 0; entryIndex < (flow.entryPoints ?? []).length; entryIndex++) {
      const entry = flow.entryPoints![entryIndex]
      // Structural entry-point shape is checked before migration above.
      void entry
    }
  }

  const flowById = new Map(flowsFile.flows.map((flow) => [flow.id, flow]))
  for (const flow of flowsFile.flows) {
    if (flow.parentId != null && !flowById.has(flow.parentId))
      error(`flow "${flow.id}": parentId "${flow.parentId}" does not exist`)
    if (flow.parentId === flow.id) error(`flow "${flow.id}": cannot be its own parent`)
    const entries = new Set<string>()
    for (const entry of flow.entryPoints ?? []) {
      const key = `${entry.flowId}\u0000${entry.fromScreenId}\u0000${entry.toScreenId}`
      const sourceFlow = flowById.get(entry.flowId)
      if (!sourceFlow)
        error(`flow "${flow.id}": entry flow "${entry.flowId}" does not exist`)
      if (entry.flowId === flow.id) error(`flow "${flow.id}": cannot be its own entry flow`)
      if (entries.has(key))
        error(`flow "${flow.id}": duplicate entry point from "${entry.fromScreenId}" to "${entry.toScreenId}"`)
      entries.add(key)
      const fromGroup = projected.groupOf.get(entry.fromScreenId)
      const toGroup = projected.groupOf.get(entry.toScreenId)
      if (!fromGroup)
        error(`flow "${flow.id}": entry source screen "${entry.fromScreenId}" does not exist`)
      else if (
        sourceFlow &&
        !sourceFlow.steps.some((screen) => projected.groupOf.get(screen) === fromGroup)
      )
        error(`flow "${flow.id}": entry source "${entry.fromScreenId}" is not in flow "${entry.flowId}"`)
      if (!toGroup)
        error(`flow "${flow.id}": entry destination screen "${entry.toScreenId}" does not exist`)
      else if (!flow.steps.some((screen) => projected.groupOf.get(screen) === toGroup))
        error(`flow "${flow.id}": entry destination "${entry.toScreenId}" is not a local step`)
    }
  }

  const childrenByParent = new Map<string, string[]>()
  for (const flow of flowsFile.flows) {
    if (!flow.parentId) continue
    const children = childrenByParent.get(flow.parentId) ?? []
    children.push(flow.id)
    childrenByParent.set(flow.parentId, children)
  }
  for (const [parent, children] of [...childrenByParent].sort()) {
    if (children.length === 1)
      warning(
        `flow "${parent}" has only one child "${children[0]}"; merge the child's steps into the parent and preserve the parent identity unless both are independently useful intents`
      )
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      const start = path.indexOf(id)
      error(`flow parent cycle: ${[...path.slice(start), id].join(" → ")}`)
      return
    }
    visiting.add(id)
    const parent = flowById.get(id)?.parentId
    if (parent && flowById.has(parent)) visit(parent, [...path, id])
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of [...ids].sort()) visit(id, [])

  for (const [group, members] of [...projected.membersByGroup].sort()) {
    if (members.length < 2) continue
    const labels = new Set<string>()
    const urlNames = new Set<string>()
    for (const member of members) {
      const label = projected.classify.state.get(member)
      if (label == null || !label.trim()) {
        error(
          `derivation group "${group}": member "${member}" must have a non-empty variation name`
        )
        continue
      }
      if (labels.has(label))
        error(`derivation group "${group}": duplicate label "${label}" (member "${member}")`)
      labels.add(label)
      const urlName = variationParam(label)
      if (!urlName)
        error(
          `derivation group "${group}": variation "${label}" (member "${member}") has no URL-safe name`
        )
      else if (urlNames.has(urlName))
        error(
          `derivation group "${group}": duplicate variation URL name "${urlName}" (member "${member}")`
        )
      else urlNames.add(urlName)
    }
  }

  for (const node of projected.nodes) {
    const title = screenTitle(node, projected.overrides)
    if (hasMachineCamelCase(title))
      error(
        `screen "${node.id}" title must use spaced words, not camel/Pascal-case text ("${title}")`
      )
  }

  const coveredGroups = new Set<string>()
  for (const flow of flowsFile.flows) {
    const localGroups = new Set<string>()
    const parentGroups = new Set(
      flow.parentId
        ? (flowById.get(flow.parentId)?.steps ?? []).map(
            (screen) => projected.groupOf.get(screen) ?? screen
          )
        : []
    )
    for (let index = 0; index < flow.steps.length; index++) {
      const screen = flow.steps[index]
      if (!projected.nodeById.has(screen)) {
        error(`flow "${flow.id}", step ${index + 1}: no screen named "${screen}"`)
        continue
      }
      const group = projected.groupOf.get(screen)!
      // A child journey may pass through multiple concrete states of its
      // parent's screen (for example Verify → Add funds → Issued card). Those
      // are exact lifecycle checkpoints, not duplicate local steps.
      if (localGroups.has(group) && !parentGroups.has(group))
        error(`flow "${flow.id}": steps contain more than one member of derivation group "${group}"`)
      localGroups.add(group)
      coveredGroups.add(group)
    }
  }

  const uncoveredByGroup = new Map<string, { id: string; reason: string }>()
  for (const id of Object.keys(flowsFile.uncovered)) {
    if (!projected.nodeById.has(id)) {
      error(`uncovered: no screen named "${id}"`)
      continue
    }
    const reason = flowsFile.uncovered[id]
    if (typeof reason !== "string" || !reason.trim())
      error(`uncovered "${id}": reason must be non-empty`)
    const group = projected.groupOf.get(id)!
    const previous = uncoveredByGroup.get(group)
    if (previous)
      error(`derivation group "${group}" is uncovered more than once ("${previous.id}", "${id}")`)
    else uncoveredByGroup.set(group, { id, reason })
  }

  for (const group of coveredGroups) {
    const disposition = uncoveredByGroup.get(group)
    if (disposition)
      error(`derivation group "${group}" is both covered and uncovered as "${disposition.id}"`)
  }

  const covered: string[] = []
  const uncovered: Record<string, string> = {}
  const unaccounted: string[] = []
  for (const [group, members] of [...projected.membersByGroup].sort()) {
    if (coveredGroups.has(group)) covered.push(...members)
    else if (uncoveredByGroup.has(group)) {
      const disposition = uncoveredByGroup.get(group)!
      for (const member of members) uncovered[member] = disposition.reason
    } else {
      unaccounted.push(...members)
    }
  }
  covered.sort()
  unaccounted.sort()
  for (const id of unaccounted) error(`screen "${id}" is unaccounted`)

  const missingNavRoots = projected.mainNav.filter((root, index, roots) => {
    const group = projected.groupOf.get(root)
    if (!group || coveredGroups.has(group)) return false
    return roots.findIndex((candidate) => projected.groupOf.get(candidate) === group) === index
  })
  if (missingNavRoots.length)
    warning(
      `main-nav section(s) with no captured journey: ${missingNavRoots.join(", ")} — walk past these tabs and re-capture`
    )

  if ((source?.flowTODO ?? []).length > 0) {
    const message = `flowTODO must be empty for a committed capture (${source.flowTODO.length} remaining)`
    if (options.strict) error(message)
    else warning(message)
  }
  for (let index = 0; index < (source?.flowTODO ?? []).length; index++) {
    const item = source.flowTODO[index]
    if (!item?.about?.trim() || !item?.question?.trim())
      error(`flowTODO[${index}] must have non-empty about and question`)
  }
  for (const migration of migrated.canonicalizations)
    warning(`${migration.location}: canonicalize "${migration.from}" → "${migration.to}"`)
  for (const migrationWarning of migrated.warnings) warning(migrationWarning)

  const ordered = orderFlows(flowsFile)
  if (ordered.length !== flowsFile.flows.length && errors.every((message) => !message.includes("parent cycle")))
    error("flow tree contains an unreachable flow")

  return {
    errors: [...new Set(errors)].sort(),
    warnings: [...new Set(warnings)].sort(),
    canonicalizations: migrated.canonicalizations,
    coverage: { covered, uncovered, unaccounted },
  }
}

export function auditFlowPackages(packages: AuditedFlowPackage[]): FlowAuditReport {
  const reports = packages
    .map((item) => {
      const graphResult = validateGraph(item.graph)
      const result = validateFlows(item.graph, item.flows, { strict: true })
      const inventory = buildInventory(item.graph)
      return {
        key: item.key,
        errors: [...new Set([...graphResult.errors, ...result.errors])].sort(),
        warnings: [...new Set([...graphResult.warnings, ...result.warnings])].sort(),
        canonicalizations: result.canonicalizations,
        screenCanonicalizations: inventory.canonicalizations,
        derivationGroups: inventory.derivationGroups,
        coverage: result.coverage,
      }
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return {
    packages: reports,
    totals: reports.reduce(
      (totals, report) => ({
        packages: totals.packages + 1,
        errors: totals.errors + report.errors.length,
        warnings: totals.warnings + report.warnings.length,
        canonicalizations: totals.canonicalizations + report.canonicalizations.length,
        screenCanonicalizations:
          totals.screenCanonicalizations + report.screenCanonicalizations.length,
        derivationGroups: totals.derivationGroups + report.derivationGroups.length,
        covered: totals.covered + report.coverage.covered.length,
        uncovered: totals.uncovered + Object.keys(report.coverage.uncovered).length,
        unaccounted: totals.unaccounted + report.coverage.unaccounted.length,
      }),
      {
        packages: 0,
        errors: 0,
        warnings: 0,
        canonicalizations: 0,
        screenCanonicalizations: 0,
        derivationGroups: 0,
        covered: 0,
        uncovered: 0,
        unaccounted: 0,
      }
    ),
  }
}
