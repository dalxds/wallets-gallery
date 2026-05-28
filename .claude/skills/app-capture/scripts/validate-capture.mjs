#!/usr/bin/env node
/**
 * Validate a capture.json against the schema in references/schema.md.
 *
 * Usage:
 *   node validate-capture.mjs <path-to-capture.json>
 *
 * Exit codes:
 *   0  — validation passed
 *   1  — validation failed (details on stderr)
 *   2  — file not found or unreadable
 *   3  — JSON parse error
 *
 * Designed to be run before writing capture.json. Catches schema violations,
 * null fingerprints, empty selectors, and broken cross-references.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ALLOWED_TOP_LEVEL = new Set([
  "schemaVersion",
  "captureDate",
  "scope",
  "flowsRecaptured",
  "previousCapture",
  "mode",
  "durationSeconds",
  "screens",
  "flows",
  "decisionPoints",
  "changes",
  "stats",
]);

const ALLOWED_SCREEN_KEYS = new Set([
  "id",
  "title",
  "role",
  "description",
  "screenshotPath",
  "snapshotPath",
  "fingerprint",
  "texts",
  "primaryCta",
  "secondaryCtas",
  "interactiveElements",
  "entryPaths",
  "appearsIn",
  "_humanEdited",
]);

const ALLOWED_FLOW_KEYS = new Set([
  "slug",
  "name",
  "parent",
  "summary",
  "mode",
  "entryPoints",
  "replay",
  "steps",
  "notes",
  "_humanEdited",
]);

const ALLOWED_STEP_KEYS = new Set([
  "number",
  "title",
  "screenId",
  "action",
  "selector",
  "description",
  "screenshotPath",
  "fingerprintBefore",
  "fingerprintAfter",
]);

const ALLOWED_DECISION_POINT_KEYS = new Set(["screenId", "options"]);
const ALLOWED_DECISION_OPTION_KEYS = new Set(["label", "explored", "flowSlug", "note"]);

const ALLOWED_REPLAY_KEYS = new Set([
  "path",
  "entryFingerprint",
  "confidence",
  "credentialsTemplate",
  "commands",
]);

const ALLOWED_INTERACTIVE_ELEMENT_KEYS = new Set(["label", "role", "selector"]);
const ALLOWED_CTA_KEYS = new Set(["label", "role", "selector"]);

const ALLOWED_ROLES = new Set([
  "home",
  "list",
  "picker",
  "form",
  "confirmation",
  "auth",
  "modal",
  "settings",
  "error",
  "other",
]);

const ALLOWED_SCOPES = new Set(["initial", "full", "flow"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const ALLOWED_MODES = new Set(["guided", "free-roam", "replay"]);

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function isFingerprint(v) {
  return typeof v === "string" && /^sha256(-text)?:[0-9a-f]+/.test(v);
}

function checkAllowedKeys(obj, allowed, ctx) {
  if (obj === null || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      err(`${ctx}: unknown key "${k}" (not in schema)`);
    }
  }
}

function checkSelector(value, ctx) {
  if (value === null || value === undefined) return;
  if (value === "") {
    err(`${ctx}: selector is empty string — use null instead`);
    return;
  }
  if (typeof value !== "string") {
    err(`${ctx}: selector must be string or null, got ${typeof value}`);
  }
}

function validate(capture, captureDir) {
  // Top-level keys
  checkAllowedKeys(capture, ALLOWED_TOP_LEVEL, "top-level");

  // Required top-level fields
  if (capture.schemaVersion !== 1) {
    err(`schemaVersion: expected 1, got ${capture.schemaVersion}`);
  }
  if (!isNonEmptyString(capture.captureDate) || !/^\d{4}-\d{2}-\d{2}$/.test(capture.captureDate)) {
    err(`captureDate: must be YYYY-MM-DD, got ${JSON.stringify(capture.captureDate)}`);
  }
  if (!ALLOWED_SCOPES.has(capture.scope)) {
    err(`scope: must be one of ${[...ALLOWED_SCOPES].join("/")}, got ${JSON.stringify(capture.scope)}`);
  }
  if (capture.previousCapture !== null && !/^\d{4}-\d{2}-\d{2}$/.test(capture.previousCapture || "")) {
    err(`previousCapture: must be YYYY-MM-DD or null, got ${JSON.stringify(capture.previousCapture)}`);
  }
  if (capture.mode !== undefined && !ALLOWED_MODES.has(capture.mode)) {
    err(`mode: must be one of ${[...ALLOWED_MODES].join("/")}, got ${JSON.stringify(capture.mode)}`);
  }

  if (!Array.isArray(capture.screens)) {
    err(`screens: must be array`);
    return; // can't continue without screens
  }
  if (capture.screens.length === 0) {
    err(`screens: must not be empty`);
  }
  if (!Array.isArray(capture.flows)) {
    err(`flows: must be array`);
    return;
  }
  if (!Array.isArray(capture.decisionPoints || [])) {
    err(`decisionPoints: must be array if present`);
  }
  if (capture.changes !== undefined && !Array.isArray(capture.changes)) {
    err(`changes: must be array if present`);
  }

  // Screens
  const screenIds = new Set();
  for (let i = 0; i < capture.screens.length; i++) {
    const s = capture.screens[i];
    const ctx = `screens[${i}] (id="${s.id ?? "<missing>"}")`;
    checkAllowedKeys(s, ALLOWED_SCREEN_KEYS, ctx);

    if (!isNonEmptyString(s.id)) err(`${ctx}: id must be non-empty string`);
    else {
      if (screenIds.has(s.id)) err(`${ctx}: duplicate screen id "${s.id}"`);
      screenIds.add(s.id);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) {
        warn(`${ctx}: id should be lowercase-kebab (got "${s.id}")`);
      }
    }
    if (!isNonEmptyString(s.title)) err(`${ctx}: title must be non-empty string`);
    if (!ALLOWED_ROLES.has(s.role)) err(`${ctx}: role "${s.role}" not in ${[...ALLOWED_ROLES].join("/")}`);
    if (!isNonEmptyString(s.description)) err(`${ctx}: description must be non-empty string`);
    if (!isNonEmptyString(s.screenshotPath)) err(`${ctx}: screenshotPath must be non-empty string`);
    if (!isFingerprint(s.fingerprint)) {
      err(`${ctx}: fingerprint missing or invalid (expected "sha256:..." or "sha256-text:...", got ${JSON.stringify(s.fingerprint)})`);
    }

    if (s.texts !== undefined && !Array.isArray(s.texts)) err(`${ctx}: texts must be array`);

    if (s.primaryCta !== undefined && s.primaryCta !== null) {
      checkAllowedKeys(s.primaryCta, ALLOWED_CTA_KEYS, `${ctx}.primaryCta`);
      checkSelector(s.primaryCta.selector, `${ctx}.primaryCta.selector`);
    }
    if (Array.isArray(s.secondaryCtas)) {
      s.secondaryCtas.forEach((c, j) => {
        checkAllowedKeys(c, ALLOWED_CTA_KEYS, `${ctx}.secondaryCtas[${j}]`);
        checkSelector(c.selector, `${ctx}.secondaryCtas[${j}].selector`);
      });
    }
    if (Array.isArray(s.interactiveElements)) {
      s.interactiveElements.forEach((e, j) => {
        checkAllowedKeys(e, ALLOWED_INTERACTIVE_ELEMENT_KEYS, `${ctx}.interactiveElements[${j}]`);
        checkSelector(e.selector, `${ctx}.interactiveElements[${j}].selector`);
      });
    }
    if (s._humanEdited !== undefined) {
      if (!Array.isArray(s._humanEdited)) err(`${ctx}._humanEdited must be array`);
      else {
        for (const fieldName of s._humanEdited) {
          if (!(fieldName in s)) {
            err(`${ctx}._humanEdited references nonexistent field "${fieldName}"`);
          }
        }
      }
    }
  }

  // Flows
  const flowSlugs = new Set();
  for (let i = 0; i < capture.flows.length; i++) {
    const f = capture.flows[i];
    const ctx = `flows[${i}] (slug="${f.slug ?? "<missing>"}")`;
    checkAllowedKeys(f, ALLOWED_FLOW_KEYS, ctx);

    if (!isNonEmptyString(f.slug)) err(`${ctx}: slug must be non-empty string`);
    else {
      if (flowSlugs.has(f.slug)) err(`${ctx}: duplicate flow slug "${f.slug}"`);
      flowSlugs.add(f.slug);
    }
    if (!isNonEmptyString(f.name)) err(`${ctx}: name must be non-empty string`);
    if (f.parent !== null && f.parent !== undefined && !isNonEmptyString(f.parent)) {
      err(`${ctx}: parent must be null or non-empty string`);
    }
    if (Array.isArray(f.entryPoints)) {
      for (const ep of f.entryPoints) {
        if (!screenIds.has(ep)) {
          err(`${ctx}: entryPoint "${ep}" not in screens[].id`);
        }
      }
    }

    // Replay (optional — null/omitted is allowed but warned)
    if (f.replay === undefined || f.replay === null) {
      warn(`${ctx}: no replay script — future re-captures will use LLM-walk only. Add notes explaining why if intentional.`);
    } else {
      checkAllowedKeys(f.replay, ALLOWED_REPLAY_KEYS, `${ctx}.replay`);
      if (!isNonEmptyString(f.replay.path)) err(`${ctx}.replay.path must be non-empty string (or set replay to null)`);
      else {
        const adPath = resolve(captureDir, f.replay.path);
        if (!existsSync(adPath)) {
          err(`${ctx}.replay.path "${f.replay.path}" — file does not exist at ${adPath}`);
        }
      }
      if (!isFingerprint(f.replay.entryFingerprint)) {
        err(`${ctx}.replay.entryFingerprint missing or invalid`);
      }
      if (!ALLOWED_CONFIDENCE.has(f.replay.confidence)) {
        err(`${ctx}.replay.confidence must be one of ${[...ALLOWED_CONFIDENCE].join("/")}, got ${JSON.stringify(f.replay.confidence)}`);
      }
    }

    // Steps
    if (Array.isArray(f.steps)) {
      f.steps.forEach((st, j) => {
        const sctx = `${ctx}.steps[${j}] (#${st.number ?? "?"} "${st.title ?? "?"}")`;
        checkAllowedKeys(st, ALLOWED_STEP_KEYS, sctx);

        if (typeof st.number !== "number") err(`${sctx}: number must be number`);
        if (!isNonEmptyString(st.title)) err(`${sctx}: title must be non-empty string`);
        if (!screenIds.has(st.screenId)) err(`${sctx}: screenId "${st.screenId}" not in screens[].id`);
        checkSelector(st.selector, `${sctx}.selector`);
        if (!isFingerprint(st.fingerprintBefore)) {
          err(`${sctx}: fingerprintBefore missing or invalid`);
        }
        if (!isFingerprint(st.fingerprintAfter)) {
          err(`${sctx}: fingerprintAfter missing or invalid`);
        }
      });
    }

    if (f._humanEdited !== undefined) {
      if (!Array.isArray(f._humanEdited)) err(`${ctx}._humanEdited must be array`);
      else {
        for (const fieldName of f._humanEdited) {
          if (!(fieldName in f)) {
            err(`${ctx}._humanEdited references nonexistent field "${fieldName}"`);
          }
        }
      }
    }
  }

  // Cross-reference flow.parent -> flows[].slug
  for (let i = 0; i < capture.flows.length; i++) {
    const f = capture.flows[i];
    if (f.parent === null || f.parent === undefined) continue;
    if (!flowSlugs.has(f.parent)) {
      err(`flows[${i}] (slug="${f.slug}"): parent "${f.parent}" not in flows[].slug`);
    }
    if (f.parent === f.slug) {
      err(`flows[${i}] (slug="${f.slug}"): parent cannot be self`);
    }
  }

  // Cross-reference appearsIn -> flows
  for (let i = 0; i < capture.screens.length; i++) {
    const s = capture.screens[i];
    if (!Array.isArray(s.appearsIn)) continue;
    s.appearsIn.forEach((ap, j) => {
      const ctx = `screens[${i}].appearsIn[${j}]`;
      if (!flowSlugs.has(ap.flow)) {
        err(`${ctx}: flow "${ap.flow}" not in flows[].slug`);
      }
    });
  }

  // Decision points
  if (Array.isArray(capture.decisionPoints)) {
    capture.decisionPoints.forEach((dp, i) => {
      const ctx = `decisionPoints[${i}]`;
      checkAllowedKeys(dp, ALLOWED_DECISION_POINT_KEYS, ctx);
      if (!screenIds.has(dp.screenId)) {
        err(`${ctx}: screenId "${dp.screenId}" not in screens[].id`);
      }
      if (Array.isArray(dp.options)) {
        dp.options.forEach((opt, j) => {
          const octx = `${ctx}.options[${j}]`;
          checkAllowedKeys(opt, ALLOWED_DECISION_OPTION_KEYS, octx);
          if (opt.flowSlug !== undefined && opt.flowSlug !== null && !flowSlugs.has(opt.flowSlug)) {
            err(`${octx}: flowSlug "${opt.flowSlug}" not in flows[].slug`);
          }
        });
      }
    });
  }

  // Stats
  if (capture.stats) {
    if (capture.stats.screensInThisCapture !== capture.screens.length) {
      err(
        `stats.screensInThisCapture (${capture.stats.screensInThisCapture}) does not match screens.length (${capture.screens.length})`,
      );
    }
  }
}

// --- main ---

const path = process.argv[2];
if (!path) {
  console.error("Usage: validate-capture.mjs <path-to-capture.json>");
  process.exit(2);
}

if (!existsSync(path)) {
  console.error(`File not found: ${path}`);
  process.exit(2);
}

let raw, capture;
try {
  raw = readFileSync(path, "utf8");
} catch (e) {
  console.error(`Could not read ${path}: ${e.message}`);
  process.exit(2);
}

try {
  capture = JSON.parse(raw);
} catch (e) {
  console.error(`Invalid JSON in ${path}: ${e.message}`);
  process.exit(3);
}

const captureDir = dirname(resolve(path));
validate(capture, captureDir);

if (errors.length === 0 && warnings.length === 0) {
  console.log(`OK: ${path}`);
  process.exit(0);
}

if (warnings.length > 0) {
  console.error(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.error(`  - ${w}`);
}

if (errors.length > 0) {
  console.error(`\nErrors (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\nFAILED: ${path}`);
  process.exit(1);
}

console.log(`OK (with warnings): ${path}`);
process.exit(0);
