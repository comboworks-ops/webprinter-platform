# Local development

Verified on 2026-09-06 in `/Users/thomasprintmaker/Documents/Antigravity stuff/printmaker-web-craft-main`, branch `ui-cleanup`, HEAD `c0ee02839e4329c6c8543101e4fca4d9d0222cda` plus the existing working-tree changes.

## Start on this Mac

From the repository root:

```sh
"/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" \
  node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8110 --strictPort
```

With Node available normally, `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8110 --strictPort` is equivalent. Keep the terminal running. The first start took about 31 seconds. If the port is occupied, inspect its owner with `lsof -nP -iTCP:8110 -sTCP:LISTEN`; do not stop unrelated project servers.

Aluminium proof entry: `http://127.0.0.1:8110/produkt/aluminium?force_domain=webprinter.dk`. On a later 6 September restart, this exact page rendered in the Codex browser with 100 × 100 cm controls, material/quantity matrix and displayed total 565 kr excluding VAT; no console errors were captured. The tab was left open for review. Checkout, designer and exported-PDF verification remain pending.

## Dependency repair and reproducibility

The old `node_modules` symlink pointed to a missing directory under another macOS account. It was replaced with a real installation using the existing pnpm lockfile. The old link target is recorded in ignored `tmp/local-dev-repair/previous-node-modules-link.txt`; the unrelated `node_modules 2` directory was left untouched.

Reinstall only when needed, using the same lockfile and without lifecycle scripts:

```sh
pnpm install --ignore-workspace --frozen-lockfile --ignore-scripts \
  --store-dir ./tmp/local-dev-repair/pnpm-store
```

This repair used bundled pnpm 11.19.0 through Node. Its entry point on this Mac is `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pnpm/bin/pnpm.cjs`. `--ignore-workspace` avoids the existing untracked `pnpm-workspace.yaml`, which contains placeholder build-policy values; that file was not changed. No package lifecycle scripts were enabled. Native development/build binaries worked with the downloaded platform packages; server-side canvas and Supabase CLI lifecycle setup were not tested.

Before/after SHA-256 values were identical:

| File | SHA-256 |
| --- | --- |
| `package.json` | `71eb2675cadca87369cea391c729e12406310f2d5727d0b8d7a5c8f29b3040a2` |
| `pnpm-lock.yaml` | `7f85ec3877a345ba713e935d533e0a79122bf9753acc515e1cfedc68341662c3` |

## Verification on 6 September

- Vite 5.4.21 started on `127.0.0.1:8110`; listener PID 46466 had this repository as its working directory. PID is historical evidence, not a process to terminate on a later run.
- Production build passed in 22.34 seconds with output directed to `/tmp/webprinter-build-2026-09-06`, preserving the existing repository `dist` directory.
- The six contract test files listed in [the baseline](LAUNCH_REVIEW_BASELINE_2026-09-05.md#e5-operations-and-proof-limits) passed again: 48 tests, no failures.
- Build warnings remain for the LCMS browser import and unresolved relative URL, plus an approximately 8.78 MB main JavaScript chunk (2.14 MB gzip). A passing build does not resolve loading performance or prove color processing.
- Local logs: `tmp/local-dev-repair/build.log` and `tmp/local-dev-repair/tests.log` (ignored, machine-local).

No application source, pricing, package versions, database records or deployed release was changed by this repair. Next: verify product selection → checkout → designer → exported PDF → checkout at 100 × 100 cm, then a non-square size. Record browser/export results in [the launch register](LAUNCH_REGISTER.md); keep L02 open until that evidence exists.
