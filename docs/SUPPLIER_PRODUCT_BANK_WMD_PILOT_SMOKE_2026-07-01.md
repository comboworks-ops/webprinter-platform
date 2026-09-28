# Supplier Bank WMD Pilot Smoke Report

Generated: 2026-07-01T12:04:10.095Z

## Scope

No Supabase writes, live product writes, publishing, supplier scraping, or live pricing writes were performed.

## Supplier Registry

External sources: 3
Enabled sources: 1
Disabled/candidate sources: 2

### Sources

- WIRmachenDRUCK (wir-machen-druck) | playwright | enabled | folders
- Pixartprinting (pixartprinting) | scrape | disabled | posters, banners, signs, rollups, stickers, labels
- Print.com (print-com) | api | disabled | flyers, folders, business_cards, letterheads, tshirts, packaging, other

### Internal Exclusions

- webprinter.dk
- www.webprinter.dk
- salgsmapper.dk
- www.salgsmapper.dk
- onlinetryksager.dk
- www.onlinetryksager.dk
- localhost
- 127.0.0.1
- 0.0.0.0

## WMD Snapshot Inputs

Clean CSV: `pricing_clean/wmd-folder-bank-pilot/20260701-124922.csv`
Latest normalized snapshot: `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-125441.json`
Previous normalized snapshot: `pricing_raw/supplier-bank-normalized/wir-machen-druck/wmd-folder-bank-pilot/20260701-124922.json`

## Price Delta Preview

Old rows: 180
New rows: 180
Changed rows: 0
Added rows: 0
Removed rows: 0
Unchanged rows: 180
Duplicate keys old/new: 0/0
Displayed change limit: 3

## Draft Import Preview

Import mode: Matrix Layout V1
Normalized price rows: 180
Quantities: 50-20000
Price range DKK: 121-5073
Formats/materials/surfaces: 1/5/2
Folds/pages/orientations: 1/1/1
Matrix quantities: 50, 100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12500, 15000, 20000

## Guarded Remote Apply Preview

The confirmed remote command remains:

```bash
node scripts/supplier-bank-cli.mjs apply-wmd-bank-pilot --confirm-remote-write
```

It validates supplier sources, applies the supplier-bank migration, seeds supplier registry rows, deploys supplier-bank Edge Functions, runs the WMD bank-only writer, and then performs read-only supplier/WMD verification.

## Current Blocker

`SUPABASE_ACCESS_TOKEN` is missing in the current session, so the remote migration, supplier seed, Edge Function deploy, and WMD bank-table write have not been applied.
