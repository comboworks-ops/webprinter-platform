# Jev supplier-import pilot

Prepared 20 September 2026. Local implementation; external activation and model accuracy are not yet verified.

## Behavior

The existing supplier URL import preview has an optional **Find forslag** action.
It evaluates the extracted public product title and meta description using pinned
`jev-1.13.0`. It suggests one of the existing fifteen product families and, when
explicitly stated, surface, adhesive and print-side descriptions.

All results require review. **Brug kategori og genanalysér** changes the manual
category and runs the existing price preview again. Properties can be copied to
the review note. They are descriptive labels, not verified supplier option IDs;
they never populate price selections or alter configuration matrices. Mapping to
actual product-specific option IDs remains a later step after a labelled pilot.

An uncertain or absent category has no adoption button. Missing/ambiguous properties
are omitted. The original source text is available for comparison. Changing the
URL/category or closing the dialog invalidates pending results and the price preview.
Provider failure never blocks manual import. No automatic Jev call occurs during
ordinary preview, saving, checkout, production, or scheduled work.

## Integration and data boundaries

- Reuses `supplier-bank-url-import` master-admin authorization and supplier registry.
- Adds a read-only `suggest` action which returns before all database write paths.
- Only bounded title (400 characters) and description (4,000 characters) go to TypeSafe.
- Staff notes, customer data, prices, raw HTML, URL query strings and credentials are excluded.
- Strictly validates model ID, every allowed answer, distributions, confidence and token usage.
- Four-second timeout, no automatic retries, 64 KB response limit, fixed HTTPS endpoint and no redirects.
- Warm-isolate cache/deduplication and twenty uncached calls/hour/operator; bounded cache and operator maps.
  This is best-effort protection, NOT a distributed limit or global billing cap. Revisit before automatic/bulk activation.
- No new packages, migrations, authentication flows, POD changes, price calculations or publishing behavior.
- The initial 0.85 review threshold is uncalibrated. It is neither 85% proven accuracy nor authorization to act.

The extractor only has static title/meta-description evidence. Dynamic attributes
may be absent. The pilot should abstain rather than infer hidden configurations.

## Activation

Server-side settings on the intended isolated Supabase function environment:

```
TYPESAFE_API_KEY=<dedicated TypeSafe key>
SUPPLIER_JEV_ENABLED=true
```

Never use `VITE_` for the key. The flag defaults off; without either setting,
the manual importer remains operational and the preview explains that suggestions
are not connected. The settings do not create a browser-visible credential.

Deploy the reviewed `supplier-bank-url-import` function together with its shared
module to the intended isolated backend before trying the real admin UI. Do not
infer hosted behavior from the synthetic checks. Production activation requires
measured Danish/German accuracy and authenticated admin acceptance.

Rollback: set `SUPPLIER_JEV_ENABLED=false`. Keep all imported products, notes,
existing prices and supplier snapshots. No data rollback is needed for suggestions.

## Verification

- 18 isolated client tests: schema checks, abstention, bounded input/output, timeouts,
  caching, concurrent deduplication, provider failures and warm-isolate limits.
- 6 handler tests execute the real endpoint with isolated service fixtures: anonymous/admin
  rejection, supplier allowlist, disabled behavior, zero writes and no calls from ordinary preview.
- Browser acceptance executes the actual dialog with synthetic service responses at
  1440, 1024, 768, 390 and 320 pixels. Covers explicit adoption/reanalysis, no automatic
  save, review notes, uncertain/failure paths, stale responses, close/reopen and console errors.
- Deno type checks for the full endpoint and shared API module, plus focused component lint.
- Full Vite production build passes from the actual Webprinter checkout; output was written
  to `/tmp/webprinter-jev-pilot-20260920/production-build`. Existing dependency, dynamic-import
  and large-bundle warnings remain. This is build evidence, not hosted acceptance.

Commands (Node 24):

```bash
node --experimental-strip-types --test supabase/functions/_shared/supplierJev.test.ts
node --test scripts/tests/supplier-jev-handler.test.mjs
node scripts/evaluate-supplier-jev.mjs
```

`scripts/tests/supplier-jev-browser.mjs` uses existing Vite/esbuild and Playwright
dependencies. Set `JEV_BROWSER_CSS` to the current built site CSS for visual checks;
its fallback CSS is functional testing only. Its server binds loopback and closes
at completion. Fixtures never send emails, save products, or call a real backend.

## Live evaluation prepared, not yet run

`scripts/fixtures/supplier-jev-cases.json` contains twenty manually labelled synthetic
Danish/German/English examples, including missing information, ambiguous alternatives
and prompt injection. The labels are not proof of real-catalogue accuracy.

The evaluation script is dry-run by default. With a securely configured key:

```bash
node scripts/evaluate-supplier-jev.mjs --live --report /tmp/supplier-jev-evaluation.json
```

Alternatively use `--api-key-file /absolute/private/key-file` with a 0600 file
containing only the key. Never pass the key itself as a command argument.
The script stops after the first provider failure and performs at most twenty calls.
At documented $0.042/M input tokens and the 64k maximum request size, twenty calls
have a theoretical model-cost ceiling of $0.05376. No other model or hosted import
is called. Estimates use returned input-token usage and exclude tax/other services.

Before expanding: evaluate a representative reviewed supplier sample, measure wrong
confident suggestions and abstention separately, and record review time saved.
Do not enable unattended product changes on the basis of the small synthetic set.

Sources checked 20 September:
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/model-jaggedness/jev-1.13
- https://docs.typesafe.ai/confidence
