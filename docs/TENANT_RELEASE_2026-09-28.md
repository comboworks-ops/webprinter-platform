# Tenant application release — 28 September 2026

## Scope

Publish the accumulated application changes approved by the owner on 28 September. All shops use the same Vercel application; each retains its own published settings, catalogue and prices. The shared graphical guide now has five illustrated steps and an editable tenant guide. The release includes the integrated sales-folder 3D previews, product/designer/checkout file-handling changes, shared site-design controls and responsive storefront/admin work.

An isolated checkout was assembled from the current application source. Local output, environment files, supplier extraction scratch, duplicate cloud files, backup source directories and review-only root HTML pages are excluded. Original local drafts and uncommitted work remain intact.

## Validation and release corrections

- Clean npm install and full Vercel production build, including six server routes.
- TypeScript: zero errors. Frontend health: zero lint regressions against the existing debt baseline (the repository is not lint-clean).
- Application unit and regression tests include tenant isolation, branding preservation, pricing display, file approval, PDF safety and sales-folder binding.
- Data API grant checker for the changed migration files.
- Restore the optional canvas entry missing from npm's lockfile and explicitly select npm for Vercel installation/build. Remove the stale secondary pnpm lockfile, which made server-function packaging select a conflicting dependency tree.
- Retire source backup/cloud duplicate files already removed from the active workspace.
- Correct native Node test import paths, retain PDF safety coverage for every current loader and remove redundant hook dependencies.

## Backend and tenant data boundaries

The six application server routes and their shared backend imports match the previous production release inputs. This release does not apply Supabase migrations, change tenant settings in bulk, change stored prices or enable unfinished 1 GB uploads. Private-file handling remains enabled and the existing 50 MB upload safeguard remains in effect. Source-controlled backend changes include work already deployed and separately gated future work; pushing their source is not evidence that new database migrations were executed.

Browser release checks cover public guides, storefront/product rendering and entry points without submitting a real order, payment or publishing tenant settings. Authenticated persistence and real commercial transactions are not proven by these checks.

## Rollback

Previous ready production deployment: `dpl_FT8zpQf9dEMuwQzFyDSCJ3qyvZgX`.

Previous production URL: `https://printmaker-web-craft-main-lt8q42ls6-thomas-projects-d80b9ddd.vercel.app`.

Restore this deployment through Vercel rollback if a release regression is observed. No database rollback is needed for this application-only release. Keep a separate record of the resulting Git commit, pull request, deployment ID and browser readback in the release output.
