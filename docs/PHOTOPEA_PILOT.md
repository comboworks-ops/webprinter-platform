# Photopea editor pilot

This pilot adds Photopea as an optional advanced editor inside Webprinter's
existing designer. It does not install or vendor the `photopea/photopea`
repository. Photopea remains a hosted, third-party application loaded from
`https://www.photopea.com`.

## Enablement

- Local Vite development exposes the pilot automatically.
- Production builds require `VITE_PHOTOPEA_PILOT=true`.
- Removing the flag hides the entry point without changing saved designs,
  pricing, checkout, export, or preflight.
- Company-controlled designer sessions do not expose the pilot.

## User flow

1. Select an image or imported PDF layer, then choose **Advanced editing**.
2. If no compatible layer is selected, choose a local PSD, PSB, AI, PDF, SVG,
   EPS, or supported image file.
3. Edit the asset inside the full-screen Photopea sidecar.
4. Choose **Save copy in Webprinter**.
5. Webprinter validates the returned PNG and inserts it as a new layer. The
   original layer and source file remain unchanged.

The normal Webprinter preflight and export pipeline stays authoritative.

## Security boundary

- Webprinter sends an in-memory `ArrayBuffer`, never a storage URL, API key,
  login token, cookie, or entire design JSON.
- Inputs are allow-listed by extension and MIME type and limited to 75 MB.
- The iframe uses a restrictive sandbox and a no-referrer policy.
- Incoming messages must match both the exact
  `https://www.photopea.com` origin and the expected iframe window.
- The bridge follows a state machine; output is ignored unless Webprinter is
  actively waiting for an export.
- Returned data is limited to 100 MB and must have a PNG signature, valid IHDR
  dimensions, no side longer than 32,768 px, and no more than 100 million
  pixels before it reaches the canvas.
- The iframe is not granted clipboard, form, modal, or download permissions.
- Output is additive: it is inserted as a new layer rather than silently
  replacing the original.

## Operational notes

- This feature requires network access to Photopea and should not be described
  as an offline or self-hosted editor.
- The embedded application loads its own assets and service endpoints from
  Photopea; those requests are governed by Photopea's policies, not
  Webprinter's backend.
- Photopea availability, behavior, and terms are an external dependency.
- A Content Security Policy should allow `frame-src https://www.photopea.com`
  on deployments that enforce CSP.
- Review Photopea's current terms and privacy documentation before moving from
  pilot to general availability.

## Verification

Run:

```sh
node --test --experimental-strip-types src/lib/designer/photopeaBridge.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
VITE_PHOTOPEA_PILOT=true npm run build
```

The browser smoke test should cover local file selection, the Photopea ready
handshake, export back to Webprinter, new-layer insertion, and console/network
errors.
