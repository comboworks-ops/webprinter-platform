# Isolated three-shop online preview — 15 September 2026

The latest local storefront is deployed as a protected Vercel preview, using only the isolated Supabase backend `cyurochbkxggcobnxaxq`. Production domains, frontend deployments, settings, pricing and customer data are unchanged.

- Updated 16 September: https://printmaker-web-craft-main-q2ykt4y6m-thomas-projects-d80b9ddd.vercel.app
- Vercel deployment: `dpl_8CiiuMEC6CGCQnV2bXBnnwKJrCtt`, READY, Preview.
- Previous 15 September preview: `printmaker-web-craft-main-la8louip3-thomas-projects-d80b9ddd.vercel.app` (`dpl_ouP4wegCkcxpMyF6Jo8Tr2SRKQNA`). It lacks the tab-isolation repair below.
- Webprinter: `/shop?tenantId=00000000-0000-0000-0000-000000000000`
- Salgsmapper: `/shop?tenantId=7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba`
- Onlinetryksager: `/shop?tenantId=7cb851f5-c792-40b1-a79a-1f7c7b5f668c`
- Test account: private ignored `output/isolated-preview-login.txt`. Never commit or upload this file.

## Scope and safeguards

The three shops have copies of their published branding and catalogue configuration. Salgsmapper retains its existing published “webprinter demo” logo text; this was not silently redesigned during the copy. Test drafts start from the published version. Live accounts, customer details, saved customer designs, orders, financial settings and credentials are not copied. The existing synthetic platform-admin account owns the test shops. Existing synthetic payment acceptance records remain separate.

The visible test banner links all three shops. Shop selection persists through bare-root navigation in this preview. The shared Supabase transport rejects other backend hosts and all Edge Functions except the three read handlers. The checkout action is disabled and no Stripe publishable key is built in. Existing server checkout and order-email gates remain disabled. Product images and PDF URLs can still read existing published assets; saved changes and uploads use test storage.

This is a static SPA preview. Production SEO/server routing is deliberately not included. Do not promote this artifact or its test database to production. A live release requires a separately built production artifact and coordinated backend rollout.

## Verification

**16 September update:** fixed a reproduced cross-tab shop-selection defect with
a tab-local sessionStorage preference. Two new regressions failed before the
repair; 32 focused tenant/account/Designer/isolation checks and the preview build
pass. On the updated hosted preview, Webprinter stays selected through product →
Designer → approved production PDF → checkout → reload while a second tab uses
Onlinetryksager. No captured warning/error console entries on the checked flow.
Actual browser-exported PDF and stored-file comparison verified 1200 × 600 mm
trim, 3 mm bleed, outlined text/vector artwork and the four-channel CMYK profile.
The Designer's 3 mm safety label and checkout's 2 mm label still need alignment.
See [release evidence and limits](PRODUCTION_RELEASE_2026-09-16.md).
Payments and outbound handlers remain blocked in this preview. Separate backend
acceptance sent seven approved test emails; Thomas confirmed receiving some.

The following bullets retain the original **15 September** copy/smoke baseline:

Catalogue copy complete: 55 tables, 201 products and 357,913 generic price rows, plus wide-format options/tiers and 937 designer templates. Table counts match the selected live-shop source scope. No original pricing formulas or values changed.

- Clean source snapshot build passes; 16 focused isolation and tenant-navigation checks pass.
- Hosted browser renders Webprinter, Onlinetryksager and Salgsmapper; Onlinetryksager branding survives navigation to `/`.
- Hosted Webprinter aluminium calculator shows 314 kr at 120 × 60 cm; product navigation retains dimensions and Designer opens at 1200 × 600 mm with 3 mm bleed. No checkout payment or file submission was performed.
- No console errors observed on the checked storefronts.
- Preview banner/page width checks pass at 1440, 1280, 1024, 768, 390 and 320 px. This is not a full mobile or performance audit.
- Final read-only checks match 12 sampled price records across the three shops; anonymous catalogue reads expose 20 / 3 / 7 published products respectively. The original six synthetic orders and five synthetic users are unchanged.
- Existing test account signs in through Auth; authenticated branding CAS save/readback/restore succeeds for all three shops. Published settings remain unchanged. This is API-level persistence proof, not a complete browser editor walkthrough.
- Public payment, email inbox delivery, signup email, supplier submission and actual production-file acceptance remain outside this browsing/design preview.
- Unauthenticated HTTP access returns a Vercel protection redirect (302) with noindex.
- Three referenced colour-profile objects copied into isolated storage; no missing source objects were encountered. Library/template HTTP URLs continue reading published source assets.

## Build and update

`node scripts/build-isolated-preview.mjs tmp/launch-staging-20260910/branch-private.json` prepares `output/isolated-launch-preview`. It takes a clean source snapshot that excludes Finder/cloud duplicate files without editing or deleting the originals, injects only the test public configuration and rejects live Stripe/service-key inclusion.

Deploy from that output directory using Vercel CLI `deploy --prebuilt --target preview --yes --scope thomas-projects-d80b9ddd`. No Git commit/push or branch switch was needed; the existing dirty worktree/index is preserved. The original domain-test worktree in `/private/tmp` was removed externally; its Git branch remains available.

Vercel browser and CLI access work. The Vercel connector alone still returns a team-scoped 403. Supabase management API reported scheduled maintenance until 21:45 UTC; direct catalogue/Auth/Storage APIs remain usable, so no new user login was needed.

## Rollback

Stop using this preview or remove only its Vercel deployment. Do not alter live domains, restore unsafe grants, or merge the staging schema baseline. Keep test database records while reviewing the copy and prior payment evidence; do not overwrite later test edits by blindly rerunning copy scripts.
