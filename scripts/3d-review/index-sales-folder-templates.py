#!/usr/bin/env python3
"""Index existing sanitized PDFs by bytes; never alter the source archive."""
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
archive = root / 'tmp/supplier-imports/wmd-sales-folders-20260831-full/documents/sanitized-pdfs'
output = root / 'output/3d-review-queue/sales-folder-batch'
output.mkdir(parents=True, exist_ok=True)
files = {hashlib.sha256(path.read_bytes()).hexdigest(): str(path.relative_to(root))
         for path in archive.glob('*.pdf')}
plan = json.loads((root / 'docs/3d-review/plan.json').read_text())
expected = {v['templatePdfSha256'] for t in plan['tickets']
            if t['family'] == 'Sales folders' and t['id'] != 'SF-5f824dd572'
            for v in t['templates']}
missing = expected - files.keys()
if missing:
    raise SystemExit(f'Missing {len(missing)} exact template PDFs: {sorted(missing)}')
(output / 'local-template-index.json').write_text(json.dumps(files, indent=2) + '\n')
print(f'Indexed {len(files)} PDFs; {len(expected)} exact catalogue hashes verified.')
