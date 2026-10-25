# REA wording and product guidance — live release

25 October 2026. Thomas approved pushing the described, already-built wording and guidance update to GitHub, Vercel and live. The shared update covers Webprinter and the existing live shop aliases, using each cohort's exact current source. The multiple-design/brochure pilots and CompanyHub acceptance backlog remain outside the release.

## Approved runtime scope

Four existing files plus four helper/component/test additions: white-label/signup wording; expandable 4+0/4+4/lamination explanations; observational automatic material/quantity notices; upload/designer/template guidance. Existing pricing/selection handlers, tenant branding, backend/schema, dependencies/configuration, POD, payment and production behavior remain unchanged. Current image-approval and DPI/CutContour overrides are preserved.

The original Webprinter candidate is READY as `dpl_Edtv5bbmTabSpaJ6DYBjyz9n9oB5`, with all 1,873 sources verified. Three additional candidates are reconstructed from their own live manifests. Their small patches accommodate the existing header imports and artwork layout differences; they do not replace their components with the Webprinter version.

## Activation and rollback plan, recorded before activation

| Cohort | Prior deployment / scoped rollback target | Approved aliases |
| --- | --- | --- |
| Webprinter | `dpl_4mwJcwxLzGhnr7BwJK2h9wAS7tCf` | webprinter.dk, www.webprinter.dk |
| Online | `dpl_GR1aWoZzcUkNa9cNfRxYxE1v9CwY` | onlinetryksager.dk, www.onlinetryksager.dk, printmaker-web-craft-main.vercel.app |
| PVC / Salgsmapper | `dpl_F8vPETPN98RU2tiz3ZMBMFUtCyXJ` | pvcbanner.dk, www.pvcbanner.dk, salgsmapper.dk, www.salgsmapper.dk |
| General address | `dpl_EpMu6gNQNwjYiQ8ZERcjuEydNa71` | printmaker-web-craft-main-thomas-projects-d80b9ddd.vercel.app |

Build with production environment and `--skip-domain`. Verify READY state, exact uploaded sources and served compiled guidance/approval policy. Re-read aliases immediately before each scoped assignment and reject unexpected changes. Preserve redirect values/status codes and every other alias, including the new GitHub branch preview. Do not globally promote or merge the auto-deploying main branch.

If a later defect requires rollback, first check for intervening releases; restore only that cohort's listed aliases to its immediate prior deployment, preserving redirects. Keep source/evidence snapshots and all customer artwork/acknowledgements. No database rollback, order mutation or file deletion is needed.

## Verification and receipts

Each candidate has 35 focused tests. The three newly adapted candidates match baseline TypeScript exactly: five existing missing roll-label test-helper diagnostics in Online and PVC/Salgsmapper; zero in general. Normalized lint remains 106 existing findings per candidate, zero added. Webprinter's unchanged staged candidate retains the same prior verification. Runtime code changes are limited to the same four files and four additions per cohort.

Fresh release evidence and per-cohort source manifests/patches: `output/rea-live-release-2026-10-25/`. Final deployment IDs, source verification, alias preservation and live browser results will be appended after completion. This release does not exercise signup, payment, orders, customer uploads or supplier/physical production.

## Final LIVE receipt

All four cohorts are LIVE on their ten approved shop aliases. All 8,337 uploaded source hashes match the reviewed candidates. The complete 37-alias inventory was checked after activation: ten shop aliases updated, 27 others unchanged, with every existing redirect/status preserved. A later GitHub branch push may advance its own non-live preview alias; it must not move any shop alias.

| Cohort | Live deployment | Verified source files | Served entry |
| --- | --- | ---: | --- |
| webprinter | `dpl_Edtv5bbmTabSpaJ6DYBjyz9n9oB5` | 1873 | `/assets/index-DeLtk_J1.js` |
| online | `dpl_BCmPZcEAH2bjB1nTkPqcmh5n7WAC` | 1866 | `/assets/index-DSqLF6-M.js` |
| pvc-sales | `dpl_3ZWANcUtqFzxy4raha4Eu7bV3KL9` | 1870 | `/assets/index-DpupaniJ.js` |
| general | `dpl_9vjfMCTx65gcbh2m5vFZXuDjTeSw` | 2728 | `/assets/index-DXQvhvSv.js` |

All four cloud builds pass. There are 35 focused tests per candidate (140 across the four source versions); new modules are lint-clean and the normalized baseline comparison adds no findings. General TypeScript passes; the other three cohorts retain their five known missing test-helper diagnostics.

Fresh LIVE browser checks cover:

- Webprinter white-label → signup link and revised plan-dependent catalogue wording; Gulvfolie artwork guidance and existing configuration.
- Online Tryksager flyer print explanation and manual 100-copy / 127 DKK selection without a false automatic-change notice.
- Salgsmapper homepage → A6 / 200 / silk / 739 DKK handoff, without a false initialization notice. Laminated-folder softfeel change shows Chromo → silk and 530 DKK; a manual 75-copy choice clears the notice; changing to A5 reports 75 → 100.
- PVCbanner's existing branded storefront/configurator, artwork guidance and two-copy price 798 DKK plus 49 delivery = 847 DKK net.

Each public-shop browser check has zero application console errors, document width equal to the 1,249 px viewport, and no local pilot launch. These are targeted desktop checks, not a fresh full accessibility/mobile or every-product acceptance claim. No signup, upload, payment, order, supplier or production submission was made. Existing image approval/DPI/CutContour code is hash-preserved and its focused regression tests pass; the earlier live file-approval interactions were not repeated by this wording/guidance release.

GitHub branch `codex/rea-records-and-release-2026-10-25` / PR #19 records the implementation, per-cohort patches/manifests and compact live receipts. Main is not merged because its automatic production assignment would collapse the distinct shop versions. Source code/evidence and local drafts are preserved; no global promotion, tenant-data write or backend/schema deployment occurred.

One bounded Vercel error-log query per deployment returned zero entries (last hour, maximum 20, all commands successful). Continuous monitoring/drains and Supabase logs were not independently audited.
