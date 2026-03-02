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

Behavior:
- Upserts exactly one `products` row by `(tenant_id, slug)`.
- Rewrites only storformat rows tied to that `product_id`.
- Does **not** modify any other product or pricing configuration.
- Uses extraction result that is already based on supplier net (`response.price`).

Delivery mapping:
- `--delivery-mode cheapest`: material tiers use cheapest delivery prices.
- `--delivery-mode fastest`: material tiers use fastest delivery prices.
- `--delivery-mode both` (default): material tiers use cheapest, plus product option surcharge tiers for fast delivery.

## Rollback

This spec and script are additive only.
- No schema changes.
- No modifications to existing Fetch/Pixart import logic.
- Remove by deleting:
  - `scripts/fetch2-wmd-roll-labels.mjs`
  - `.agent/skills/fetch2/`
  - `docs/FETCH2_WMD_ROLL_LABELS_SPEC.md`
