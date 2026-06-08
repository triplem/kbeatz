# kbeatz Logo Assets

This directory contains the kbeatz logo and related visual assets.

## Files

| File | Description |
|---|---|
| `kbeatz-logo.svg` | Primary logo - dark circular background, purple/magenta K with lamp motif |
| `kbeatz-logo-dark.svg` | Dark-mode variant - transparent background, brightened purple K with lamp motif |

## Design

The kbeatz logo combines two visual elements:

- **Kotlin K shape**: the three-element K (vertical stem + upper arm + lower arm) rendered in the
  Kotlin brand purple-to-magenta gradient, mirroring the official Kotlin K geometry.
- **Lamp / light bulb motif**: a glowing bulb placed at the tip of the upper K arm, representing
  the "beatz lamps" visual inspiration. The warm yellow-orange glow contrasts the cool purple K.

The overall palette is deep purple/near-black background with a purple-magenta K and amber lamp
glow, giving the logo a vibrant, dark-themed identity.

## Alt Text Reference

Use the following alt text values consistently across all contexts:

| Context | File | Alt text |
|---|---|---|
| README.md header | `kbeatz-logo.svg` | `kbeatz logo` |
| GitHub Pages site header | `kbeatz-logo.svg` | `kbeatz logo` |
| GitHub Pages site (dark mode) | `kbeatz-logo-dark.svg` | `kbeatz logo` |
| Favicon or small icon usage | `kbeatz-logo.svg` | `kbeatz` |
| Social / Open Graph image | `kbeatz-logo.svg` | `kbeatz - self-hosted music collection manager` |

For HTML `<img>` elements:
```html
<img src="docs/assets/kbeatz-logo.svg" alt="kbeatz logo" width="128" height="128">
```

For Markdown:
```markdown
![kbeatz logo](docs/assets/kbeatz-logo.svg)
```

## Size Guidelines

The SVG is defined on a 512x512 viewBox and scales cleanly to any size. Recommended sizes:

| Use | Size |
|---|---|
| README header | 128x128 px |
| Docs site header | 64x64 px |
| Favicon (converted to .ico) | 32x32 px |
| Full-resolution export | 512x512 px |

## Generating a PNG Export

The SVG is the canonical source. To generate a PNG (e.g. for GitHub README compatibility in
contexts that do not render SVG), use `rsvg-convert`:

```bash
rsvg-convert -w 512 -h 512 docs/assets/kbeatz-logo.svg -o docs/assets/kbeatz-logo.png
```

Or with ImageMagick:

```bash
convert -background none -resize 512x512 docs/assets/kbeatz-logo.svg docs/assets/kbeatz-logo.png
```

The PNG is not committed to the repository - generate it locally or in CI as needed.

## Brand Notes

The Kotlin K shape in this logo is inspired by the Kotlin brand geometry but is a derivative
original work, not a direct copy of the official Kotlin wordmark or logo. Refer to the
[Kotlin brand assets guidelines](https://kotlinlang.org/docs/kotlin-brand-assets.html) before
using the official K mark in any commercial or promotional context.
