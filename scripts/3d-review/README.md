# Sales-folder model generation

Run from the repository root with Python packages in `requirements.txt` available. These scripts read PDFs and write local review evidence/generated TypeScript; they never call a database or change a template PDF.

1. `python3 scripts/3d-review/index-sales-folder-templates.py`
2. `python3 scripts/3d-review/audit-sales-folder-templates.py`
3. `python3 scripts/3d-review/inspect-legacy-sales-folder.py`
4. `python3 scripts/3d-review/generate-sales-folder-registry.py`

The existing sanitized archive is under `tmp/supplier-imports/wmd-sales-folders-20260831-full/documents/sanitized-pdfs/`. The legacy file is preserved as `output/3d-review-queue/sales-folder-batch/legacy-template.pdf`; expected SHA-256 is `6bb307f051fb3f39c96e21e959b795cd4b449544244e4c1e2ae75af941a03abe`.

`build-sales-folder-models.py` contains the extraction/partition library and an optional representative report. The audit inspects every actual PDF, including finish-specific differences, and writes `template-audit.json`. The generator consumes the audit and legacy inspection; it must not be used to approve a new family or bypass identity/geometry checks. Review the diff and run the mockup tests before accepting regenerated data.

This run used the bundled Python executable with `PYTHONPATH=/private/tmp/sales-folder-geometry-deps`. No repository package manifest or global Python environment was changed. Missing source/evidence should be recovered before regeneration; do not silently substitute an approximately similar PDF.
