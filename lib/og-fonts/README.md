# OG card fonts

TTFs embedded into the Open Graph cards by `lib/og.tsx` (passed to `next/og`'s
`ImageResponse`, bundled into the OG functions via `outputFileTracingIncludes` in
`next.config.mjs`). Satori needs `ttf`/`otf`/`woff` — **not** `woff2` — so these are
static `.ttf` instances, one file per weight.

The cards are set in **Inter** to match the app (`app/layout.tsx` loads it via
`next/font/google`); Noto Sans is a glyph-coverage fallback only.

| File | Family / weight | Role |
|------|-----------------|------|
| `Inter-Regular.ttf` | Inter 400 | metadata / fallback |
| `Inter-SemiBold.ttf` | Inter 600 | app-name eyebrows, wordmark, chips |
| `Inter-Bold.ttf` | Inter 700 | display headings |
| `NotoSans-Regular.ttf` | Noto Sans 400 | fallback for glyphs Inter lacks (extended Latin, Greek, Cyrillic, symbols) — never selected directly |

## Provenance

Both families are licensed under the **SIL Open Font License 1.1**
(<https://openfontlicense.org>). Static `.ttf` weights pulled from the Google Fonts
CDN (the `css2` endpoint serves `.ttf` rather than `.woff2` to a legacy User-Agent):

- **Inter** — © The Inter Project Authors (`https://github.com/rsms/inter`)
- **Noto Sans** — © The Noto Project Authors (`https://github.com/notofonts/latin-greek-cyrillic`)

To refresh or add a weight, request the specific `.ttf` from Google Fonts with a
legacy UA, e.g.:

```bash
URL=$(curl -s -A "Mozilla/4.0" \
  "https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap" \
  | grep -oE "https://[^) ]+\.ttf" | head -1)
curl -s -A "Mozilla/4.0" "$URL" -o Inter-Bold.ttf
```

Full Latin coverage (~325 KB/Inter weight). CJK/RTL scripts are **not** covered —
a capture title in those scripts falls back to Noto Sans (Latin/Greek/Cyrillic);
true CJK would need a script-specific Noto subset (multi-MB) added here.
