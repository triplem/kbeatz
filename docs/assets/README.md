# kbeatz Brand Assets

## Files

| File | Use |
|---|---|
| `kbeatz-logo.svg` | Main logo, dark background baked in. Used at the top of the repository README. |
| `kbeatz-logo-transparent.svg` | Transparent background, dark wordmark. For light backgrounds (docs, print). |
| `kbeatz-icon.svg` | 256x256 square app-style icon (disc and CD case spines). Usable directly as an SVG favicon. |
| `kbeatz-icon-512.png` | 512px PNG export of the icon. For platforms that do not accept SVG (GitHub avatar). |

All assets are pure SVG with no embedded fonts, scripts, or raster images
(except the PNG export). They render identically in any standards-compliant
viewer.

## Design

- Icon motif: a shelf of coloured CD case spines with an iridescent silver
  disc pulled out in front - the CD collection that kbeatz manages.
- Wordmark: Poppins Bold converted to baked path outlines with correct
  kerning. The k carries a violet-to-pink gradient; the audio pulse
  underline picks up the spine colours.
- The disc centre hole is punched with an SVG mask so the transparent
  variant stays truly transparent.

## Font licence

The wordmark outlines are derived from Poppins, licensed under the
SIL Open Font License 1.1. The OFL explicitly permits converting glyphs to
outlines for use in logos and documents; no attribution is required in the
artwork itself.

## Regenerating

The SVGs are hand-maintained; edit them directly. Two parts are generated:

**Wordmark paths** (if the text or font ever changes): extract glyph
outlines with fontkit and re-bake them into the `<g transform=...>` wordmark
group of both logo variants.

```bash
npm install fontkit @fontsource/poppins
node -e "
const fontkit = require('fontkit');
const font = fontkit.openSync('node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff');
const run = font.layout('kbeatz');
let x = 0;
for (let i = 0; i < run.glyphs.length; i++) {
  console.log(run.glyphs[i].path.translate(x, 0).toSVG());
  x += run.positions[i].xAdvance;
}
console.log('total advance width:', x);
"
```

The paths are in font units (1000 per em, y up). The wordmark group flips
and scales them into place: `scale(s,-s)` where `s = targetWidth / totalAdvanceWidth`.

**PNG icon export** (after changing `kbeatz-icon.svg`):

```bash
npm install sharp
node -e "
require('sharp')('kbeatz-icon.svg', { density: 192 })
  .resize(512, 512).png().toFile('kbeatz-icon-512.png');
"
```
