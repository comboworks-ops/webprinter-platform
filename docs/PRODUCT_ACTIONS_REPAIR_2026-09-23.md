# Product publication and tenant-distribution access

The new default ProductLocator screen omitted existing publish/distribution actions. ProductOverview returned early before its management UI and distribution dialog. The only management link was below hundreds of filter values (inside collapsed filters on mobile). Neither backend operation had been removed; this was workflow reachability lost during the product-list redesign. The issue existed in both the workspace and the running recovered localhost copy, unlike the earlier upload source mismatch.

Restored Publicer på siden / Skjul på siden and Send til lejere beside every product in the current list, using the existing ProductOverview handlers and unchanged tenant/matrix-price safeguards. The exact existing distribution dialog now mounts from both views. Administrer produkter is at the top, retaining access to release-to-tenant availability, cloning, categories and other management controls. No pricing, RPC, schema or publishing behavior changes. No products published or sent during QA.

Verification: real signed-in master at localhost 8113; searched Aluminium Skilte and opened Send dialog, saw existing shops plus Standard pris / POD-pris; cancelled with zero recipients. Draft Salgsmapper rows show Publicer; published Aluminium shows Skjul. Widths 1440,1280,1024,768,390,320 show both actions without document overflow; viewport reset. Typecheck and production build pass, three locator behavior tests pass. ProductLocator lint clean. ProductOverview retains the same 19 errors and 2 warnings as its pre-change baseline; comparison found no new diagnostic messages.

Source ownership: workspace remains authoritative; active localhost serves /private/tmp/featured-product-review-2026-09-22/app. All three repair files are byte-identical in both copies, recorded in output/product-actions-repair-2026-09-23/runtime-sync.json. The inaccessible iCloud original of ProductLocator is preserved under cloud-original in that evidence folder; its size and mtime matched the running recovery before use. Scoped before files and repair.patch support selective rollback.

## Continuation plan

1. Preserve these entry points during any later product UI changes: open/edit, upload/remove/scale image, publish/hide, tenant release/send, clone, and categories. Check actual signed-in roles and both default/management routes.
2. Before claiming a localhost fix is visible, check its process root and confirm scoped workspace/runtime source hashes match. Do not blindly synchronize the whole dirty workspace.
3. Keep QA reachability checks separate from actual publication or distribution to shops; verify those writes only against explicitly chosen products/recipients or isolated fixtures.
4. Upload 1 GiB activation and immediate file handoff/retention remain unfinished; the current 50 MiB backend limit remains.
