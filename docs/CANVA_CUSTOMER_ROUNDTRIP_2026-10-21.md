# WebPrinter customer Canva roundtrip

Status: implemented and deployed to an isolated pilot; **not connected to Canva or enabled for live customers**.

Customers choose an assigned A5 flyer on a product page, connect their own Canva account, enter six text fields and one JPG/PNG photo, generate a separate copy, edit it in Canva and fetch a fresh PDF into WebPrinter's existing private upload and proof-approval flow. Saved copies can be reopened from Mine designs → Mine Canva-designs. Existing manual Canva links remain available.

## Scope and sources

The pilot contains the two WebPrinter flyers. MenuMaker menus and embrlla social posts are outside this adapter.

| Key | Customer source | Tested parent | Original (untouched) |
| --- | --- | --- | --- |
| florist-a5-v1 | DAHYo7VYqns | DAHYo2p64v4, repaired florist | DAHYomcyWbM |
| bicycle-a5-v1 | DAHYoy_4X5U | DAHYo6F2CrE, passing bicycle test | DAHYoq-m1mU |

The two customer sources are separate copies in [WebPrinter's collection](https://www.canva.com/folder/FAHYoh37uG0). Only their demo-footer text was removed; six text fields plus `hero_image` were verified after saving. The six original collection designs and the prior test/repair sources were not edited. Gallery PNGs are locally retained example previews, explicitly labelled Eksempel; they show the original demo copy, not a live customer preview.

`shared/canva.ts` is the versioned source/field contract. Text limits are conservative guardrails, not a guarantee for every font, word or manual Canva edit. Customers check line breaks and image cropping in Canva. The server checks the actual dataset before uploading/generating, because Canva silently skips unknown fields.

## Implementation and security

- Product admin selects `canva.mode = autofill` and an explicit `canva.template_keys` list. Both shop and product Canva switches must be enabled. The product's selected dimensions must match an assigned source; no automatic resizing or substitution.
- `canva-workflow` authenticates every request with Supabase Auth. Draft, token and OAuth-state lookups are scoped by user and tenant. Product publication, shop ownership/master fallback and explicit assignment are checked server-side.
- OAuth authorization-code flow uses S256 PKCE, random one-use state, ten-minute expiry, fixed redirect URI and encrypted server-side tokens. AES-GCM additional data binds ciphertext to user and tenant. Refresh uses a database claim and re-reads the token after acquiring it.
- Three new tables have explicit service-role grants, RLS and no browser/public access. The browser never receives Canva access/refresh tokens or client secrets.
- Photo uploads are bounded to 8 MiB and MIME/magic checked. They go to the customer's Canva account. API hosts are fixed; export URLs must use the exact official download host and redirects are rejected. PDFs are bounded to 50 MiB and checked for a PDF signature.
- Generation is exclusively `create_from_design`. Client operation IDs and atomic status claims prevent duplicate upload/autofill POSTs after lost responses. Uncertain generation does not retry automatically. A stale starting state becomes an actionable failed draft.
- Temporary edit URLs are fetched afresh. The return URL's `correlation_jwt` is removed and **never decoded or used as an authorization or design-selection input**. The signed-in customer resumes their own stored draft or selects it from their list, then explicitly requests import. This is intentionally not an automatically trusted Canva-return callback.
- Each import starts a fresh, request-bound PDF export. Reopening the editor invalidates prior exports. Old export requests cannot download a newer export, and concurrent edits cannot silently replace the selected snapshot.
- The existing private upload path stores the returned PDF with its hash and capability. The selected checkout/quote snapshot is preserved; `proofApprovalRequired=true`, `designerExport=null`. Existing checkout repricing/authorization remains authoritative. No pricing, POD, payment, order submission or production rules changed.

## Activation packet

Read-only deployed-secret metadata on 21 October found **no CANVA-named secrets** in live project `ziattmsmiirfweiuunfo`. No secrets were read or changed. No migration, function deployment, product setting, tenant setting or production frontend change was made.

1. Choose/create a Canva Developer app owned by WebPrinter. This is separate from the Canva connector used in this chat.
2. Start with **one exact HTTPS pilot origin**. Set its OAuth redirect and Canva return-navigation URL to `https://<pilot-origin>/canva-designs`. The handler rejects multi-origin configuration: one app currently has one fixed return destination. Cross-domain tenant return brokerage is not implemented. Multiple tenants on the same origin remain scoped by tenant ID.
3. Request `design:content:read`, `design:content:write`, `design:meta:read`, `asset:read`, `asset:write`. Verify app review/distribution requirements with Canva for real external customers. Current autofill requires an eligible Canva plan (Pro, Teams or Enterprise, including qualifying Education/Nonprofits).
4. Verify a **different customer's token** can read both source datasets and create a copy. Source presence in the owner's folder or successful use of the chat connector does not prove external-customer access. Arrange the supported Canva sharing/template distribution model without giving customers edit access to the protected originals. Do not enable the product until this check passes.
5. Install server secrets through the deployment secret store: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_TOKEN_ENCRYPTION_KEY` (random 32-byte key encoded as 64 hex characters), `CANVA_ALLOWED_ORIGINS` (the single origin), `CANVA_WORKFLOW_ENABLED=false`. Never put secrets in Vite variables or Git. Existing modern Supabase secret/publishable keys remain unchanged.
6. Apply only `20261021120000_canva_customer_roundtrip.sql` to the selected isolated backend first; deploy `canva-workflow` with its explicit JWT setting. Do not replay unrelated historical migrations.
7. Build frontend with `VITE_CANVA_WORKFLOW_ENABLED=true`, enable the server flag on the isolated pilot and select the two source keys for an A5 flyer via the existing product settings. Enable the shop's existing Canva switch.
8. Complete real OAuth → photo → autofill → editor → return → PDF → private upload → proof acceptance with two different customer accounts and two shops, including denied foreign-draft probes. Confirm actual bleed/trim, page count, image resolution and font/CMYK behavior through the existing print preflight. No automatic PDF Print/CMYK/bleed guarantee is claimed by this API adapter.
9. Review the exact matched migration/function/frontend packet for the live pilot, then enable the relevant live product. Broader custom-domain rollout needs a separate return-origin solution.

OAuth rows expire logically after ten minutes; operational retention/deletion for stale OAuth states and customer drafts should be configured before a broad rollout. Existing user/tenant deletion cascades remove their connection and draft rows.

## Verification

- Whole application TypeScript passes.
- Production Vite build passes (existing large-bundle warning).
- 3 launch tests and 16 Deno server/security tests pass, including complete mocked roundtrip, dataset drift, customer/shop isolation, unpublished/unassigned products, upload bounds/MIME, encryption binding, PKCE, callback expiry/replay, uncertain writes and fresh-export invalidation.
- Supabase grant and function-exposure checks pass.
- New modules and changed MyDesigns page pass scoped ESLint; no lint rules were weakened.
- Local Chrome exercises the actual customer page with synthetic account/provider/storage responses: 390/768/1280 widths, failure recovery with fields/photo retained, create, edit, return, reload and private-PDF checkout handoff with original quantity/quote and new approval requirement. No customer-screen runtime errors. Vite HMR's websocket was blocked by Chrome's local-network policy; the intentional mocked 503 was expected.
- Browser fixtures replace the account provider and storefront frame; these checks do **not** prove real login, real tenant branding, hosted storage, Canva API permission, print quality or production deployment.
- Existing production dependency audit reports 25 findings (1 critical, 18 high, 4 moderate, 2 low). No runtime dependency was added or lockfile changed in this work. Resolve/review that pre-existing backlog separately before release; it is not a clean audit.

Commands:

```sh
npm run typecheck
node --test src/lib/canva/launch.test.ts
npx --yes deno@2.5.6 test --allow-env supabase/functions/canva-workflow/security.test.ts supabase/functions/canva-workflow/workflow.test.ts
npm run check:supabase-grants
npm run check:supabase-functions
npm run build
```

Local browser evidence is in `output/canva-roundtrip/` (ignored). The test harness uses mocked responses and must not be deployed as a customer entry point.

## Rollback

Disable `CANVA_WORKFLOW_ENABLED` and remove the frontend feature flag. Keep the restrictive table grants/RLS and all customer records. Existing manual-link mode continues to work. Do not drop tables or edit source/master designs, and do not revert any pricing/POD code. Re-enable only after repairing and rerunning the relevant checks.

## API references checked on 21 October 2026

- [Create design autofill job](https://www.canva.dev/docs/apps/rest-apis/reference/autofills/create-design-autofill-job/)
- [Get design dataset](https://www.canva.dev/docs/apps/rest-apis/reference/designs/get-design-dataset/)
- [Create asset upload job](https://www.canva.dev/docs/apps/rest-apis/reference/assets/create-asset-upload-job/)
- [Generate access token](https://www.canva.dev/docs/apps/rest-apis/reference/authentication/generate-access-token/)
- [Return navigation](https://www.canva.dev/docs/apps/rest-apis/return-navigation-guide/)
- [Create design export job](https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/)


## Isolated pilot checkpoint — 21 October 2026

The owner confirmed that existing Canva Connect integration **printmaker**, client
ID `OC-AZ0pA8oTAtJc`, is the intended integration. Public distribution is Draft.
The current OAuth redirect and enabled return URL both still point to
`https://dkqylfxakglxjcbibzsb.supabase.co/functions/v1/canva-oauth/callback`.
Required design/asset scopes are already enabled; profile:read is also enabled.
No Canva portal setting, credential or design was changed in this checkpoint.

- Isolated backend: `cyurochbkxggcobnxaxq` (existing webprinter-launch-test branch).
- Applied only migration `20261021120000_canva_customer_roundtrip.sql`. All three
  tables have RLS, no anon/authenticated read grants, and service-role writes.
- `canva-workflow` version 2 is ACTIVE with **verify_jwt=true**. Automatic approval
  review rejected deploying with the gateway check disabled. The safer deployment
  with normal gateway verification succeeded; signed-session compatibility still
  needs a real check. The handler also independently calls Auth getUser().
- Installed client ID, single exact origin and fresh encryption key only in the
  isolated backend. `CANVA_WORKFLOW_ENABLED=false`; client secret remains missing.
- Preview: https://webprinter-platform-6evw3gsfx-thomas-projects-d80b9ddd.vercel.app
  (deployment `dpl_Fy8XRA7UTdxPyqjqG37MrRd3ZTvm`, Vercel authentication protected).
- Intended OAuth and return URL: the preview origin plus `/canva-designs`.
- `--canva-test` isolated build permits only the Canva handler and existing private
  file handler in addition to the read endpoints. Payments, email, suppliers,
  unknown handlers and other backend origins stay blocked. No production alias
  was changed. No customer/shop/product settings were changed.
- 10 launch/preview-boundary tests and 16 Canva server/security tests pass. App
  TypeScript, scoped ESLint and isolated production build pass. Existing bundle
  size warning remains. These are not a completed live Canva roundtrip.

Browser handoff: sign into Vercel in the prepared preview tab. A concrete action-time
confirmation is pending for adding the preview OAuth redirect, setting its return
URL, and generating an additional Canva client secret for the isolated backend.
Browser security policy requires that confirmation for new credential/access
changes. Preserve the existing secret. Do not paste credentials into chat or Git.
After approval, install the new secret directly in the isolated secret store,
verify signed-session authentication, assign the two flyer sources to isolated A5
products, enable only the isolated flag, and test actual customer access, edit,
return, fresh PDF upload and approval. Two-account/two-shop acceptance and print
preflight remain open. No live rollout is authorized by passing a simulated test.

Rollback: keep the pilot flag false, preserve private tables and records, and
retain the existing production sites. Record before/after Canva settings before
changing them. The six original designs and both customer source copies remain
unchanged by deployment.


## Canva portal connection checkpoint — 21 October, 13:42 UTC

The user gave explicit action-time approval for the exact pilot redirect,
return destination and one additional client secret. Portal readback confirmed:

- Added OAuth URL 2: `https://webprinter-platform-6evw3gsfx-thomas-projects-d80b9ddd.vercel.app/canva-designs`.
- Preserved OAuth URL 1 (previous backend callback).
- Return navigation remains enabled and now targets the pilot `/canva-designs` URL.
- Both changes showed **All changes saved**. Screenshots are under
  `output/canva-roundtrip/redirect-after.jpg` and `return-after.jpg`.

**Credential incident / urgent follow-up:** the initial “Generate another secret”
opened a confirmation modal; the first confirmation attempt was blocked by review.
A read-only count proved only the original secret existed and the initial modal
was still open. After that evidence the approved confirmation succeeded, creating
exactly one new secret. Canva automatically marked the previous credential
**Expiring client secret**, with **in 23 hours** shown. This contradicted the
promised preservation of the existing credential, and the user was promptly told.
Do not generate again or remove either credential. Any older consumer of the
previous secret must migrate before Canva's displayed expiry; the old backend is
not managed by this pilot and has not been modified. No undo control was observed.

The tool masks the secret in DOM/native reads; its secure browser clipboard read
returned empty despite a Copied! toast. No usable secret was read, logged, saved
to a local file, or installed in Supabase. The Canva credential tab must stay open
because the new value is available only once. The user was asked to sign in to the
prepared Supabase/GitHub and Vercel tabs. After sign-in, transfer directly from the
Canva Copy control into the isolated secret-store value field for
`CANVA_CLIENT_SECRET` without displaying it in chat. If native paste is unavailable,
ask the user to complete that exact paste/save themselves. Keep the pilot disabled
until the secret is verified. Full customer OAuth/autofill/edit/export testing is
still pending; no Canva designs, shop/product settings or production sites changed.
