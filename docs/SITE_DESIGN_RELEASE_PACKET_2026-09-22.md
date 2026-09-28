# Site Design release packet — 22 September 2026

> **Owner feedback update:** the featured-product banner and inspector have since
> changed locally. See [the featured-product review](FEATURED_PRODUCT_REVIEW_2026-09-22.md).
> The verified candidate and counts below describe the preceding release packet;
> they do not by themselves cover this new delta. Final browser recheck and owner
> acceptance of the new work remain pending. No deployment has occurred.

**Local cleanup and scoped release preparation are complete. Nothing was deployed
and no live data was written.** Templates remain free or master-assigned; old
prices and purchase/assignment records are preserved, and paid checkout remains
disabled.

| Result | Verified |
| --- | --- |
| Full application TypeScript | 171 reported previously → 0 (complete-input comparison 170 → 0) |
| Active-source ESLint | 2,354 → 1,980 errors; warnings 173 → 156 |
| Retired source | 42 files preserved in a hash-verified archive |
| Full application tests | 536 passed |
| Scoped candidate's affected tests | 51 passed |
| Browser acceptance | 31 passed on each candidate; synthetic data, three viewport sizes |
| Production builds | Full working source and scoped Site Design candidate both pass all six server routes |
| Regression check | Clean types; no per-file/rule lint increases; negative case rejected |

See [the complete cleanup and release review](SITE_DESIGN_LEGACY_CLEANUP_2026-09-22.md)
for exact scope, behavior, limitations, evidence and rollback.

## Concrete artifacts

The evidence folder is
`output/site-design-audit-2026-09-21/legacy-cleanup-2026-09-22/`.
`cleanup.diff` preserves this pass's changes separately from the large existing
worktree diff. `scoped-site-design.diff` and `scoped-source.tar.gz` reconstruct the
Site Design candidate against the recorded production snapshot; manifests record
both sides. The candidate changes 66 source files plus five presentation assets,
the lint configuration and npm/pnpm lock housekeeping. Dependency ranges and
package.json are unchanged; all API/shared backend sources match the baseline.

The recorded baseline's 1,184 file hashes match. Its deployment identity is
`dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX`; fresh public checks confirm all three shops still serve the recorded entry
bundle. Authenticated deployment metadata remains unverified because the connected
Vercel tool lacks access to this project team (403). Compare any intervening
production changes and confirm the exact deployment before releasing.

Both local build archives are retained. The **full-worktree archive includes
unrelated local work**, so use the scoped review candidate for release planning.
No environment files or credentials were copied. No migration or live permission
repair needs replaying for these local changes.

## Open acceptance gates

| Gate | Required next step |
| --- | --- |
| Remaining lint debt | 1,980 explicit `any` errors and 156 warnings remain. The new check prevents count increases; ordinary lint still fails and the repository is not lint-clean. |
| Scoped rollout | Review the candidate against the then-current production baseline and obtain release authorization. No deployment was performed. |
| Normal authentication | Verify login, logout, recovery and return to the order/editor in the selected shop. |
| Commercial order | Shop/product selection is pending. Prepare exact options, artwork, proof and total before any authorized real charge or submission; verify one order/file, tax, receipt and fulfillment. |
| Communications | Intended recipient and authorized real-message check remain pending. No message was sent. |
| Physical devices | Available devices are pending. Verify upload/proof/navigation and real reduced-motion/media behavior. Emulated viewports do not close this gate. |

The prior local implementation checkpoint is retained as
`previous-release-packet.md` in this evidence folder. The full audit keeps the
earlier hosted-permission and isolated-backend evidence separately.
