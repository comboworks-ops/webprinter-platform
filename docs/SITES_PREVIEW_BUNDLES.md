# Sites Preview Bundles

Use this to render each site package with its own real visual assets in `/preview-shop`.

## Folder layout

Create one folder per site id:

`public/site-previews/<site-id>/manifest.json`

Example:

`public/site-previews/print-pop/manifest.json`

## Manifest format

### Option A: render exported site directly (recommended)

```json
{
  "mode": "iframe",
  "entry": "/site-previews/print-pop/index.html"
}
```

If the repo can export a static build, place the build files in:

`public/site-previews/print-pop/`

and point `entry` to that exported `index.html`.

### Option B: keep mock layout but use repo-specific visuals

```json
{
  "mode": "mock",
  "heroImage": "/site-previews/print-pop/hero.jpg",
  "galleryImages": [
    "/site-previews/print-pop/product-1.jpg",
    "/site-previews/print-pop/product-2.jpg"
  ],
  "headline": "Print Pop",
  "subline": "Repo-specific look and campaign text.",
  "palette": {
    "bg": "#111827",
    "bgSoft": "#1F2937",
    "panel": "#1F2937",
    "border": "#374151",
    "text": "#F9FAFB",
    "mutedText": "#9CA3AF",
    "heroGradient": "linear-gradient(135deg, #2563EB 0%, #EC4899 100%)",
    "primary": "#2563EB",
    "secondary": "#EC4899"
  }
}
```

## Notes

- Paths can be absolute (`/site-previews/...`) or full `https://` URLs.
- If no manifest exists, preview falls back to the built-in mock view.
- `mode: "iframe"` gives closest match to the original repo CSS/layout.
