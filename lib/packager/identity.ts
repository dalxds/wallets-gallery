// Screen identity primitives. Build/CLI-only (imports node:crypto).
//
// The fingerprint is byte-compatible with the legacy capture pipeline
// (_staging/fingerprint.py): sha256 of the Python-`json.dumps` serialization of
// the sorted (role,label) pairs of hittable elements, truncated to 24 hex chars.
// We keep parity so existing captures keep stable identities through migration.

import { createHash } from "node:crypto"
import type { InteractiveElement } from "./types.ts"

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex")

/** General-purpose normalization: lowercase, trim, collapse internal whitespace. */
export function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ")
}

// ── Fingerprint ──────────────────────────────────────────────────────────────
//
// sha256 of the sorted (role,label) pairs of interactive elements. Deterministic
// and order-independent. This is the canonical identity going forward; legacy
// captures used a different routine over the raw snapshot, so their hashes are
// reused as opaque ids during migration rather than recomputed.

/** role: last dotted segment, lowercased, trimmed (e.g. android.widget.Button → button). */
export function fpRole(role: string): string {
  return String(role ?? "").split(".").pop()!.toLowerCase().trim()
}

/** label as fingerprint.py derives it: lowercased, whitespace-collapsed. */
export function fpLabel(label: string): string {
  return normalize(label)
}

export function computeFingerprint(elements: Pick<InteractiveElement, "role" | "label">[]): string {
  const pairs: [string, string][] = elements.map((e) => [fpRole(e.role), fpLabel(e.label)])
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  return "sha256:" + sha256hex(JSON.stringify(pairs)).slice(0, 24)
}

// Tier 2/3 fallback: a screen with no usable snapshot has no interactive elements
// to fingerprint, so derive identity from the sorted, normalized screenshot texts.
// The `sha256-text:` prefix marks the lower-confidence form (validate accepts both).
export function computeTextFingerprint(texts: string[]): string {
  const norm = texts.map(normalize).filter(Boolean).sort()
  return "sha256-text:" + sha256hex(JSON.stringify(norm)).slice(0, 24)
}

// ── Dynamic-content normalization (near-duplicate / merge detection) ─────────

/**
 * Strip volatile content so two captures of the same screen with different data
 * compare equal: currency amounts, bare numbers, percentages, @handles,
 * hex/addresses, and timestamps all collapse to typed placeholders.
 *
 * Token/coin NAMES are deliberately NOT normalized here. Two screens that differ
 * only by a token ("…purchase of VIRTUAL" vs "…ETH") share a skeletonHash and have
 * near-identical pixels, so the SAF already merges them on skeleton + pHash — no
 * hardcoded ticker vocabulary (which is app-specific, rots, and only helps screens
 * that happen to lack a usable screenshot) belongs in this identity primitive.
 */
export function normalizeDynamic(text: string): string {
  return normalize(
    String(text ?? "")
      .replace(/0x[0-9a-f]{6,}/gi, "{addr}")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, "{time}")
      .replace(/[$€£]\s?\d[\d,]*(?:\.\d+)?/g, "{money}")
      .replace(/\b\d+(?:\.\d+)?\s?%/g, "{pct}")
      .replace(/@[a-z0-9_.]+/gi, "{handle}")
      .replace(/\b\d[\d,]*(?:\.\d+)?\b/g, "{num}")
  )
}

// ── Skeleton hash ────────────────────────────────────────────────────────────
//
// Structure-only identity that survives data changes, used to cluster variants
// of one logical screen. The authoritative form (production) hashes the snapshot
// TREE (roles + nesting + child counts). When no snapshot is available (legacy
// captures, Tier 2/3 screens) we fall back to a proxy: the screen role + the
// sorted multiset of element roles, or — for element-less screens — the
// dynamic-normalized text shape.

export function skeletonFromElements(role: string, elements: Pick<InteractiveElement, "role">[]): string {
  if (elements.length === 0) return ""
  const roles = elements.map((e) => fpRole(e.role)).sort()
  return "sk:" + sha256hex(role + "::" + roles.join(",")).slice(0, 24)
}

export function skeletonFromTexts(role: string, texts: string[]): string {
  const shape = texts.map(normalizeDynamic).filter(Boolean).join("|")
  return "skt:" + sha256hex(role + "::" + shape).slice(0, 24)
}

// ── Perceptual-hash distance ─────────────────────────────────────────────────

/** Hamming distance between two hex-encoded pHash strings (e.g. "p:ab12…"). */
export function pHashDistance(a: string | null, b: string | null): number {
  if (!a || !b) return Infinity
  const ha = a.replace(/^p:/, "")
  const hb = b.replace(/^p:/, "")
  if (ha.length !== hb.length) return Infinity
  let dist = 0
  for (let i = 0; i < ha.length; i++) {
    let x = parseInt(ha[i], 16) ^ parseInt(hb[i], 16)
    while (x) {
      dist += x & 1
      x >>= 1
    }
  }
  return dist
}
