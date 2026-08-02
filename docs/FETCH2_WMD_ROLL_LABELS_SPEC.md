# Fetch2 Spec: WIRmachenDRUCK Roll Labels (Free Size)

## Scope

Product:
- `Hochwertige Etiketten auf Rolle, freie Größe rechteckig`
- `https://www.wir-machen-druck.de/hochwertige-etiketten-auf-rolle-freie-groesse-rechteckig.html#content-view`

Goal:
- Extract supplier prices across:
  - material (`#sorten`)
  - quantity
  - width/height (cm, max supplier limit)
  - delivery option (standard/express)
- Produce normalized files and import one new additive storformat product in Webprinter.

## Endpoint Contract (discovered)

Main pricing endpoint:
- `POST /wmdrest/article/get-price`

Related option endpoints used by supplier UI:
- `POST /wmdrest/article/get-options`
- `POST /wmdrest/article/get-sorten-auflage`
- `POST /wmdrest/article/get-splitted-sorten-options`
- `POST /wmdrest/article/print-template`

Observed payload keys for `get-price`:
- `token`
- `isIndividualQuantity`
- `categoryId`
- `shopId`
- `userId`
- `articleId`
- `quantity`
- `substrateId`
- `additionalUpsells`
- `width`
- `height`
- `ownPrintData`
- `articleOptions`
- `deliveryOption`
- `forwardingShipment`
- `keyword`
- `remarks`
- `referenceTxt`
- `voucherCode`

Observed response fields (in `data.response`):
- `currency` (`EUR`)
- `basePrice`
- `deliveryCharge`
- `price` (net total)
- `priceWithTax`
- `priceScaleId`
- `priceModel` (`m2`)

## Shape Handling

Supplier page is rectangle-based.

For Webprinter configuration flexibility, `fetch2` produces:
- `rectangle` rows (direct quote)
- `circle` rows (derived from rectangle quote, same price, `radius_cm = min(width,height)/2`)

## Quantity + Size Sampling Defaults

Sizes (cm):
- `1x1,2x2,3x3,4x4,5x5,7x7,10x10,12x12,15x15,20x20`

Quantities:
- `10,100,200,250,500,1000,2000,3000,4000,5000,7000,10000,15000,20000,30000`

## Price Transform Defaults

Applied in `scripts/fetch2-wmd-roll-labels.mjs`:

1. `dkk_base = eur_net * 7.6`
2. If `dkk_base <= 3000` apply `+70%`
3. If `dkk_base > 3000` apply `+60%`
4. Round to step `1`

Flags allow overrides:
- `--eur-to-dkk`
- `--markup-low-pct`
- `--markup-high-pct`
- `--threshold-dkk`
- `--rounding-step`

An opt-in evidence path can replace the legacy fixed FX input:

- `--fx-snapshot-file <json>` reads an already captured EUR/DKK
  Frankfurter/ECB snapshot from disk. The importer never contacts the provider.
- `--pricing-buffer-pct <non-negative-number>` records a separate buffer; it is
  never folded into the FX rate or markup evidence.
- Snapshot rates have at most six decimal places. Converted cost, buffer,
  markup, and final DKK values keep their exact decimal evidence; only the
  commercial final-price rule performs rounding.

## Artifacts

Generated in `pricing_raw/`:
- `wmd-roll-labels-free-size-<timestamp>.json`
- `wmd-roll-labels-free-size-<timestamp>.csv`
- `wmd-roll-labels-free-size-<timestamp>.summary.csv`

Summary includes `cheapest` and `fastest` delivery picks per `(material,size,quantity)`.

## Import Mode (Additive)

Command:
- `node scripts/fetch2-wmd-roll-labels.mjs import --dry-run --input "<json>"`
- `node scripts/fetch2-wmd-roll-labels.mjs import --input "<json>" --tenant-id "<uuid>" --product-name "<name>" --product-slug "<slug>" --publish`
- `node scripts/fetch2-wmd-roll-labels.mjs import --input "<json>" --tenant-id "<uuid>" --fx-snapshot-file "<snapshot.json>" --pricing-buffer-pct 2.5 --write-snapshot-draft --import-id "<uuid>"`

Behavior:
- Upserts exactly one `products` row by `(tenant_id, slug)`.
- Rewrites only storformat rows tied to that `product_id`.
- Does **not** modify any other product or pricing configuration.
- Uses extraction result that is already based on supplier net (`response.price`).
- Without snapshot evidence, the existing legacy import and `--publish`
  behavior is unchanged.

Snapshot write safety:

- `--fx-snapshot-file` selects snapshot pricing, but does not authorize a
  database write. A non-dry-run import additionally requires the separate
  `--write-snapshot-draft` confirmation and an explicit `--import-id` UUID.
  The confirmation flag is rejected when either identity or snapshot evidence
  is absent. Retrying the same import ID derives the same child row IDs;
  different import IDs cannot collide.
- Snapshot mode rejects `--publish` and rejects an existing product or
  storformat config that is already published.
- The service-role-only
  `apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)` RPC locks the
  product row, checks draft status under that lock, and replaces product,
  material, tier, m2, variant, and layout/config rows in one transaction.
- Publication racing after the import waits for the complete transaction.
  Publication winning the race makes the waiting import fail without changing
  the product. Any insert or constraint failure rolls all deletes and updates
  back.
- Supplier and stored tier prices must be strictly positive canonical decimal
  values. Zero, negative, non-finite, exponent, and over-precision values are
  rejected before a write.
- A snapshot-managed draft remains visible in StorformatManager, but its
  pricing editor is read-only. Database policies fence direct authenticated
  editor writes so they cannot race the authoritative service-role import.

Delivery mapping:
- `--delivery-mode cheapest`: material tiers use cheapest delivery prices.
- `--delivery-mode fastest`: material tiers use fastest delivery prices.
- `--delivery-mode both` (default): material tiers use cheapest, plus product option surcharge tiers for fast delivery.

## Rollback

This spec, script path, and database changes are additive only.
- The migration set adds `rounding_mode` to `storformat_configs`, the private `wmd_snapshot_draft_import_state` table, narrowly granted import/revision RPCs, and restrictive policies that make snapshot-managed drafts read-only to the authenticated editor.
- No modifications to existing Fetch/Pixart import logic.
- Operational rollback disables new snapshot writes by revoking `EXECUTE` on
  `apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)` from
  `service_role`. Existing imported draft data and additive schema objects stay
  in place. Reversing those objects requires a new reviewed forward migration;
  never delete or rewrite an already-applied migration file.
