// Perceptual hash of a PNG screenshot — dependency-free (Node's built-in zlib).
//
//   decode → grayscale → 32×32 → DCT → median-threshold → 64-bit hash ("p:<16 hex>")
//
// Computed at capture / backfill time and baked into graph.json `node.pHash`. The
// packager only COMPARES hashes (identity.ts → pHashDistance); it never decodes
// images, so this lives in scripts/, not lib/packager/.
//
// CLI: node scripts/phash.ts <png>   → prints the hash (or "(null)").

import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"

interface Gray {
  width: number
  height: number
  gray: Float64Array // row-major luminance
}

const SIG = [137, 80, 78, 71, 13, 10, 26, 10]

// Decode an 8-bit, non-interlaced PNG (color types 0/2/3/4/6) to grayscale.
// Returns null for anything exotic (16-bit, interlaced) — caller leaves pHash null.
function decode(buf: Buffer): Gray | null {
  for (let i = 0; i < 8; i++) if (buf[i] !== SIG[i]) return null
  let pos = 8
  let width = 0,
    height = 0,
    bitDepth = 0,
    colorType = 0,
    interlace = 0
  let palette: Buffer | null = null
  const idat: Buffer[] = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString("ascii", pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    pos += 12 + len // length(4) + type(4) + data + crc(4)
    if (type === "IHDR") {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === "PLTE") palette = Buffer.from(data)
    else if (type === "IDAT") idat.push(Buffer.from(data))
    else if (type === "IEND") break
  }
  if (bitDepth !== 8 || interlace !== 0 || !width || !height) return null
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0
  if (!channels) return null

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const recon = new Uint8Array(height * stride)
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    const row = y * stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++]
      const a = x >= channels ? recon[row + x - channels] : 0
      const b = y > 0 ? recon[row - stride + x] : 0
      const c = x >= channels && y > 0 ? recon[row - stride + x - channels] : 0
      let val: number
      switch (filter) {
        case 0: val = cur; break
        case 1: val = cur + a; break
        case 2: val = cur + b; break
        case 3: val = cur + ((a + b) >> 1); break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          val = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default: return null
      }
      recon[row + x] = val & 255
    }
  }

  const gray = new Float64Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * stride + x * channels
      let g: number
      if (colorType === 0 || colorType === 4) g = recon[o]
      else if (colorType === 3 && palette) { const idx = recon[o] * 3; g = 0.299 * palette[idx] + 0.587 * palette[idx + 1] + 0.114 * palette[idx + 2] }
      else g = 0.299 * recon[o] + 0.587 * recon[o + 1] + 0.114 * recon[o + 2]
      gray[y * width + x] = g
    }
  }
  return { width, height, gray }
}

function downscale32(d: Gray): number[] {
  const N = 32
  const out = new Array(N * N).fill(0)
  for (let oy = 0; oy < N; oy++) {
    const y0 = Math.floor((oy * d.height) / N)
    const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * d.height) / N))
    for (let ox = 0; ox < N; ox++) {
      const x0 = Math.floor((ox * d.width) / N)
      const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * d.width) / N))
      let sum = 0, cnt = 0
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += d.gray[y * d.width + x]; cnt++ }
      out[oy * N + ox] = cnt ? sum / cnt : 0
    }
  }
  return out
}

function hashFrom32(g: number[]): string {
  const N = 32, K = 8
  const cos = new Float64Array(N * K)
  for (let x = 0; x < N; x++) for (let u = 0; u < K; u++) cos[x * K + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))
  const coeffs = new Array<number>(K * K)
  for (let u = 0; u < K; u++) {
    for (let v = 0; v < K; v++) {
      let sum = 0
      for (let x = 0; x < N; x++) {
        const cu = cos[x * K + u]
        const row = x * N
        for (let y = 0; y < N; y++) sum += g[row + y] * cu * cos[y * K + v]
      }
      const au = u === 0 ? Math.SQRT1_2 : 1
      const av = v === 0 ? Math.SQRT1_2 : 1
      coeffs[u * K + v] = au * av * sum
    }
  }
  // threshold by the median of the non-DC coefficients
  const sorted = coeffs.slice(1).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  // pack 64 bits as two 32-bit halves (avoids BigInt; identical hex to a 64-bit int).
  // NB bit 0 is the DC coefficient (the largest), so it's > median on essentially every
  // screen — effectively a constant 1 that contributes 0 to every Hamming distance. The
  // hash is thus ~63 discriminating bits; harmless, but don't read the width as a full 64.
  let lo = 0, hi = 0
  for (let i = 0; i < 64; i++) {
    if (coeffs[i] > median) {
      if (i < 32) lo |= 1 << i
      else hi |= 1 << (i - 32)
    }
  }
  return "p:" + (hi >>> 0).toString(16).padStart(8, "0") + (lo >>> 0).toString(16).padStart(8, "0")
}

export function pHashFromPng(path: string): string | null {
  try {
    const d = decode(readFileSync(path))
    return d ? hashFrom32(downscale32(d)) : null
  } catch {
    return null
  }
}

if (process.argv[1] && process.argv[1].endsWith("phash.ts")) {
  const p = process.argv[2]
  if (!p) { console.error("usage: node scripts/phash.ts <png>"); process.exit(2) }
  console.log(pHashFromPng(p) ?? "(null)")
}
