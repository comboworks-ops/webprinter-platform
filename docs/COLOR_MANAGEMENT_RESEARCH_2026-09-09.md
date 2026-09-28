# Webprinter color management: findings and proposed changes

Implementation follow-up: see `docs/COLOR_MANAGEMENT_IMPLEMENTATION_2026-09-09.md`. The ECI redistribution terms were checked during implementation: FOGRA51/52 use official per-shop installation and ignored local developer copies, not newly bundled production assets.

Date: 2026-09-09. Scope: current local source/assets, a reproduced local browser test, available Agent System tools, and primary-source research. This is an implementation proposal; no application code, profile assignments, production files or services were changed.

## Decision

Keep the existing Little CMS foundation. First repair preview sampling and profile resolution, then add a small validated profile library with product-specific guidance. Give production PDF output a separate implementation: the existing normal export puts a proof-simulated RGB image into a PDF and does not preserve designer text as vector text.

Three concepts must remain explicit:

1. **Source profile:** describes the original image/artwork colors, such as sRGB.
2. **Proof target:** the printing condition simulated on screen.
3. **Production output policy:** whether Webprinter converts to an agreed output profile or preserves tagged source colors for the supplier's RIP to convert.

The same ICC file can participate in multiple stages, but those operations are not interchangeable. Assigning a profile describes existing numbers; converting changes numbers to preserve appearance. Adding an ICC OutputIntent describes the intended output condition and does not by itself convert PDF objects or establish PDF/X compliance.

## What exists in the application

| Capability | Source-confirmed state | Consequence |
|---|---|---|
| ICC conversion | `lcms-wasm` 1.0.5 installed; active Web Worker uses real Little CMS transforms | No need to invent a color conversion engine |
| Built-in profiles | One output: `ISOcoated_v2_300_eci.icc`, FOGRA39/300%; one input: sRGB | Current label should explicitly identify the 300% variant |
| Profile manager | `/admin/farveprofiler`: tenant listing, upload, name/description, details and deletion | Useful starting point, not a complete production profile library |
| Upload validation | Extension check; all uploaded profiles recorded as `cmyk_output` | Parse and validate real ICC class, color space and transform support before offering profiles |
| Product assignment | Schema, loader and selector component exist; selector appears absent from current product-admin JSX | Restore the visible connection before claiming product defaults work |
| Uploaded-profile selection | Panel can list tenant profiles, but Designer omits its tenant ID; engine resolves only built-ins or the one loaded product profile | Wiring the dropdown alone would permit a displayed name to disagree with loaded bytes |
| Normal print PDF | Same proof-image exporter as proof PDF; CMYK buffer is ignored | Text/shapes become pixels, and the PDF is proof-simulated RGB |
| Vector PDF | Imported PDF page is preserved; newly added objects are a transparent PNG; CutContour is separately written as vector spot strokes | Imported vectors survive, but newly created text does not become vector text |
| PDF service | Implemented authenticated Stirling adapter, disabled by default | Infrastructure can be reused; no ICC-conversion or PDF/X operation currently exists |

Important source pointers:

- [Profile catalog](../src/lib/color/iccProofing.ts), around line 26.
- [Active ICC worker](../src/workers/colorProofing.worker.ts), transforms around lines 97-119 and 275 onward.
- [Profile upload](../src/components/admin/ColorProfilesManager.tsx), around line 116.
- [Product-profile loader](../src/hooks/useProductColorProfile.ts), around lines 53-120.
- [Product selector](../src/components/admin/ProductColorProfileSelector.tsx); [product admin](../src/components/admin/ProductPriceManager.tsx) imports/initializes/saves its state but does not render the selector.
- [Export dispatch and RGB PNG embedding](../src/lib/designer/export/exportActions.ts), around lines 68-74 and 228-255.
- [Vector-background export](../src/lib/designer/export/exportVectorPdfBackground.ts), around lines 129-185.
- [Designer](../src/pages/Designer.tsx), order-artwork builder around line 1943 also uses proofed RGB. The comment about OutputIntent near line 3344 only sets ordinary title/subject/keywords metadata.
- [PDF service contract](../src/lib/designer/pdfService.ts) and [Stirling integration status](STIRLING_PDF_INTEGRATION.md). The older `OPEN_DESIGN_STIRLING_PDF_PLAN.md` predates the implemented adapter.

These findings describe the dirty local checkout. They do not establish current hosted tenant records or a running private Stirling instance.

## Why text becomes softer in the preview

The ICC worker changes pixel color values without spatial blurring. Sampling around the worker introduces the sharpness loss:

1. The hook captures the zoomed document at multiplier 1 without Retina scaling.
2. It reduces the longest side to at most **1,000 pixels**.
3. It enlarges the transformed image into an overlay with logical document dimensions.
4. CSS scales that overlay again for the viewport. Toolbar zoom can stretch the old proof because proofing has no explicit zoom dependency.

On a 2x display, the unproofed Fabric canvas can therefore have twice the linear display detail of the captured proof. Small type and thin lines reveal this quickly. See [useColorProofing](../src/hooks/useColorProofing.ts), lines 144-166, 265-310 and 334-379, and the overlay around [Designer](../src/pages/Designer.tsx) line 4753.

### Browser reproduction

Tested `http://127.0.0.1:8110/designer?format=A4` against PID 76611, whose working directory was confirmed as this exact checkout. One unsaved default text object was used; Chrome reported devicePixelRatio 2.

| Measurement | Normal Fabric canvas including pasteboard | Proof document overlay |
|---|---|---|
| Backing pixels | 1264 x 1612 | 432 x 606 |
| CSS size at 100% zoom | 632 x 806 | 432 x 606 |
| CSS size at 200% zoom | Same viewport, content rerendered at new zoom | 864 x 1212 |

Proofing visibly softened text at 100% and 200%. At 200%, each overlay backing pixel occupied 4 x 4 physical display pixels. Refreshing the proof at 200% did not restore detail; turning proof off did. This example did not need to hit the 1,000-pixel cap: the additional logical-size overlay resampling and missing display density were already sufficient to reproduce the issue.

The live selector showed only ISO Coated v2 (FOGRA39), and the console error query returned no errors. The temporary test tab was closed after restoring proof off and zoom 100%. No save, upload or export occurred.

Evidence: [measured canvas dimensions](../output/research/color-management-2026-09-09/dimensions.json), [proof off at 200%](../output/research/color-management-2026-09-09/proof-off-200.png), [proof on after refresh at 200%](../output/research/color-management-2026-09-09/proof-on-200-refreshed.png). The same folder contains the 100% comparison.

Color simulation can also legitimately make black appear less deep because ink on paper differs from a luminous display. That tonal change is separate from softened edges. Excluding text from color proofing would conceal some color changes and is not an accurate general solution.

| Option | Benefit | Tradeoff | Recommendation |
|---|---|---|---|
| Render proof at displayed size times device-pixel ratio; avoid intermediate resizing | Sharp text at ordinary zoom; fits current architecture | More pixels to transform | First implementation |
| Quick proof while moving, sharp proof after editing; visible-area tiles at large zoom | Responsive editing and detail on large documents | Scheduling, cancellation and tile boundaries need care | Follow after basic correctness |
| Object-aware vector text/shapes plus managed image rendering | Better foundation for sharp exported artwork | Fonts, transparency, blends, clipping and object order make it a larger exporter project | Production PDF work |

Preserve the existing document-only crop, pasteboard/guide positioning, source objects and three-argument `cmsDoTransform` API. Give overlay backing pixels the actual worker-result dimensions. Refresh on zoom, display-density changes and text edits. Use a memory/pixel budget rather than unconditionally rendering a whole large-format page at maximum zoom. Turning off image smoothing alone cannot recover discarded detail.

## Profile selection must become trustworthy

Before adding files, implement one profile resolver shared by proofing and export. It must return the exact selected file, validated metadata and a checksum; a missing or invalid selection must show an error rather than silently using FOGRA39.

Current gaps in [useColorProofing](../src/hooks/useColorProofing.ts):

- Lines 206-218 resolve an unknown profile ID to the first built-in profile.
- Product bytes are selected only when the saved choice already refers to that product profile (105-118).
- Old `fogra51`/`swop` IDs are explicitly reset to FOGRA39 (398-404).
- Profile initialization has no request generation/cancellation, so quick switches risk out-of-order completion.
- Designer passes `isReady={true}` to the panel instead of real engine readiness.

The proposed effective policy is: an explicit, permitted product/variant recipe; otherwise a configured shop/process default; otherwise an honest unconfigured state. Existing saved designs and approved supplier requirements must retain their recorded profile version. Never replace FOGRA39 across all products just because newer profiles are available.

Current preview intent is fixed to Relative Colorimetric, without a black-point-compensation flag. A configurable Relative Colorimetric plus black-point-compensation default is a reasonable proposal for supported European print workflows, subject to supplier validation; Perceptual can be evaluated for photographs with substantial out-of-gamut colors. Keep paper-color simulation a separate proof option. [Adobe documents these intent and compensation choices](https://helpx.adobe.com/acrobat/using/color-settings.html). The current gamut warning uses an RGB color-shift threshold, not a true Little CMS gamut-check transform; label or replace it accordingly.

Each library record should hold:

- Exact ICC name, role/class, color space, version, checksum, source and license.
- Print process, substrate and intended printing condition.
- Supplier plus printer/ink/print-mode requirements when relevant.
- Submission format, conversion owner, approved rendering settings and black-text policy.
- Proof-only versus production approval, last validation and usage references.

Customers should normally see **“Recommended for this product”** with a short reason; technical identifiers belong in details. Example: “Coated paper — PSO Coated v3, as specified by this printer.” A garment preset might say: “Supply sRGB artwork; the printer handles the garment color conversion.” Variant-level material choices may require different recipes.

## Starter library and guidance by print method

| Printing workflow | Recommended library entry or policy | Qualification |
|---|---|---|
| RGB images / browser artwork / supported supplier submission | sRGB | Source/submission profile, not a universal CMYK output choice |
| Coated sheetfed offset | PSO Coated v3, FOGRA51 | Only when the printer uses/accepts this printing condition |
| Uncoated sheetfed offset | PSO Uncoated v3, FOGRA52 | Characterized uncoated stock with optical brighteners; not every uncoated substrate |
| Existing coated offset contracts | ISO Coated v2 300%, FOGRA39 | Keep for supplier compatibility and existing products |
| Digital paper presses | Supplier submission preset + calibrated press/RIP output | An agreed offset simulation target may be valid; it is not automatically the actual device profile |
| Wide format: banners, vinyl, boards | Supplier/device profile tied to printer, ink, media and print mode | No universal “wide-format CMYK” profile |
| DTG / DTF clothing | Supplier-specific input; sRGB where requested | Production also depends on garment, ink, white underbase and RIP settings |
| Sublimation | Printer/ink/transfer-paper/product-specific production preset | Substrate and transfer conditions matter |
| Screen printing | Agreed spot colors and separations | ICC process-color conversion does not replace ink and separation specifications |

[ECI's official downloads](https://eci.org/doku.php_id=en_downloads.html) provide the offset profiles, with ISO Coated v2 in the older-profile section. [Fogra's characterization table](https://fogra.org/en/downloads/work-tools/characterisation-data) documents FOGRA51, FOGRA52 and FOGRA39. FOGRA58 TextileRGB is an **exchange space**, not a universal clothing output profile.

[ONYX's input/output profile documentation](https://help.onyxgfx.com/24/ONYXGo/Content/Job%20Editor/ICC%20Profile%20Setup/ICC%20Profile%20Setup.htm) and [media-profile workflow](https://help.onyxgfx.com/19/ProductionHouse/Content/Media%20Manager/Edit%20Media%20Profiles/Edit%20Media%20Profiles.htm) explain the printer/ink/media/mode dependencies. [Printful explicitly recommends sRGB submission](https://help.printful.com/hc/en-us/articles/28491774495772-Should-I-use-RGB-or-CMYK-for-Printful-print-files); this is a supplier example, not a rule for all textile printers. [Sawgrass documents product and paper settings](https://care.sawgrassink.com/hc/en-us/articles/30135618064795-Choosing-the-Best-Color-Mode-for-Your-Project) for sublimation.

Use one owner for final device conversion. Avoid applying a production correction in Webprinter and then applying it again in the printer/RIP. [Adobe's printing guidance](https://helpx.adobe.com/indesign/desktop/print/color-output-and-separations/use-color-management-when-printing.html) illustrates this distinction. Preserve black text as single-channel black where the production specification calls for it; don't force photographic blacks through the same text rule. [Adobe's object-aware color conversion](https://helpx.adobe.com/acrobat/using/color-conversion-ink-management-acrobat.html) is a useful reference.

Official availability does not automatically establish redistribution rights. Inspect the exact ECI archive's included terms and ICC copyright tag before bundling. ICC's [sRGB registry](https://registry.color.org/rgb-registry/srgbprofiles) links profile-specific terms; sRGB2014 v2 has permissive [ICC profile terms](https://www.color.org/profileview/). Do not assume a v4 preference profile is an interchangeable upgrade for every existing v2 workflow. Keep supplier profiles with their own permissions and provenance.

## Existing tools and external candidates

The Agent System router search found general PDF authoring/inspection skills and the existing PDF skill, but no dedicated ICC print-production specialist. Its PDF tools cover rendering, text/font/object inspection and test reports. They are useful for QA; they do not supply measured printer profiles or a production color workflow.

| Tool | Useful role | Decision |
|---|---|---|
| [Little CMS](https://github.com/mm2/Little-CMS) | ICC color transforms and proofing | Retain as the core; MIT license, actively maintained upstream |
| [lcms-wasm](https://github.com/mattdesl/lcms-wasm) | Browser/worker wrapper around Little CMS; already installed | Reuse integration, but verify bundled native-core provenance and update strategy |
| Existing jsPDF / pdf-lib / PDF.js | PDF construction, preservation/import/rendering and verification | Useful building blocks; current composition must change to retain new text/vectors |
| [Ghostscript](https://github.com/ArtifexSoftware/ghostpdl) | Candidate server PDF color-conversion and inspection/rendering processor | Bounded technical prototype candidate; licensing and document-preservation acceptance remain open |
| Existing Stirling-PDF adapter | Authenticated private PDF processing boundary, immutable results | Reuse relevant service infrastructure; current operations do not solve ICC/PDF/X output |
| [ArgyllCMS](https://www.argyllcms.com/) | Create/calibrate profiles from measured print charts | Optional print-shop tooling if we operate the printer and have measurement hardware |

Little CMS upstream HEAD was checked as `ab329ad5ce09dbb1f3547b6c126031aca606eb42` (2026-09-08). The much smaller lcms-wasm wrapper's HEAD was `6cf6ea553785738e182ce71f5254868b78d3c6a3` (2025-01-08), unarchived; installed version is 1.0.5. Active upstream development does not prove the installed WASM includes the current native fixes.

Read-only package provenance checks established that installed 1.0.5 JavaScript/WASM match the published npm archive and its SHA-512 integrity. The application's `public/lcms.wasm` also matches. The npm tag points to `762214c66e907674c8a5538223c624291f5039dd`, a version-only change immediately after main. The pinned native source is `c2a54017d73080f97c5cd34a78ff2fb51564aade`, identifying Little CMS **2.16**; upstream stable 2.19.1 was released in May 2026. Review native updates before expanding production use. Matching published bytes establishes package identity, not absence of vulnerabilities or a reproducible source-to-WASM build.

The wrapper's intake verdict is **Static review passed; isolated test only**, with medium confidence. All 18 text files (341,192 bytes) and archive metadata were inspected without execution. No credible malicious behavior or exposed credentials was found. Its browser loader fetches the selected WASM binary; no added telemetry or hidden account calls were found. The build has no locked Emscripten toolchain or attestation. The native core, WASM disassembly, complete transitive dependency audit and unreachable Git objects were outside coverage. Small low-level API issues merit tests before adding new pixel formats or metadata APIs. [Pinned wrapper source](https://github.com/mattdesl/lcms-wasm/tree/6cf6ea553785738e182ce71f5254868b78d3c6a3) and [pinned native header](https://github.com/mm2/Little-CMS/blob/c2a54017d73080f97c5cd34a78ff2fb51564aade/include/lcms2.h) identify the assessed versions.

| Wrapper intake dimension | Score, 10 best | Reason |
|---|---|---|
| Safety and trust | 6/10 | Transparent wrapper and verified distribution identity; native/binary review incomplete |
| Project health | 4/10 | Last wrapper push January 2025, old native core, small maintenance footprint |
| Integration readiness | 7/10 | Already integrated, with build/API maintenance still needed |
| Business usefulness | 8/10 | Direct fit for browser ICC proofing |
| Overall recommendation | 6/10 | Retain the foundation and own maintenance before broader production use |

Ghostscript GitHub mirror HEAD was `b9a5853f5df16d6bc5e083fe9e6728d82f7dbe95` (2026-09-07). Its [pdfwrite documentation](https://ghostscript.readthedocs.io/en/latest/VectorDevices.html#color-conversion-and-management) supports color-conversion strategies, but explicitly notes limits: rendering-device object-specific controls and `KPreserve` do not automatically apply to pdfwrite. A generic command is therefore not proof of correct black-text handling, spot preservation or PDF/X-4 compliance. It also cannot restore vector text after our exporter has rasterized it.

[Artifex offers AGPL and commercial licensing](https://artifex.com/licensing); settle the applicable commercial-service terms before integration. [Stirling's current license](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE) has MIT portions and separately licensed directories; do not treat the entire distribution as uniformly MIT. Current ArgyllCMS identifies its command-line collection as AGPL and [documents measured printer profiling](https://www.argyllcms.com/doc/Scenarios.html). These are capability and licensing shortlists, not full security clearance of the native projects.

## Proposed implementation order and acceptance

**First: sharp and honest proofing.** Repair display-resolution capture, avoid resampling, refresh after zoom/text editing, cancel stale worker requests, pass actual readiness and resolve selected profile bytes consistently. Verify small text, thin lines, saturated colors, clipping, guides and transparent objects at multiple zooms and display densities. The proof must use the same visible viewport bounds as the normal canvas and leave guide drawing to its intended layer. Switching profiles must change the actual transform, including after reload and on two products with different assigned profiles.

**Second: useful profile library and product guidance.** Add validated PSO Coated v3 and PSO Uncoated v3 assets after checking archive terms; retain the exact FOGRA39/300% entry. Keep sRGB available in the correct source/submission role. Expose the existing product-assignment control with a clear recommendation reason, and connect process/material-specific supplier profiles. Reject incompatible/malformed profiles and prevent deleting a profile still used by products or recorded production recipes.

**Third: production PDF fidelity.** Create a distinct export that preserves imported vector content and emits supported new text/shapes as PDF text/vector objects, with embedded fonts or deliberate outlined-vector fallback. Rasterize only unsupported effects with explicit resolution rules. Preserve original source colors until the agreed conversion stage; retain spot colors/CutContour, page boxes, transparency and black-text policy. Attach a real ICC OutputIntent where required and verify the requested PDF/X variant with a suitable preflight tool. Keep customer proof images as separate artifacts.

Acceptance must inspect actual PDF objects, fonts, color spaces, OutputIntent and separations, not just a screenshot or filename containing “CMYK.” Include tiny black type, colored text, imported vector PDFs, images with embedded profiles, gradients/transparency and CutContour. Compare a reference proof in a trusted color-managed application, then obtain a physical print on the intended process. A sharp browser preview is not a calibrated contract proof.

No pricing, POD v1/v2, publishing or supplier-order behavior needs to change for the first two phases. Production-export changes should have their own reviewed scope and rollback: preserve original design/PDF data and the previous exporter until fidelity acceptance passes.
