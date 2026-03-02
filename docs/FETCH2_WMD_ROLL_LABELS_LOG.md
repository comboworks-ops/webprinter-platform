# Fetch2 Log: WIRmachenDRUCK Roll Labels

Date: 2026-02-25

## URL
- `https://www.wir-machen-druck.de/hochwertige-etiketten-auf-rolle-freie-groesse-rechteckig.html#content-view`

## Extraction outcome

Confirmed dynamic supplier API endpoints in browser session:
- `POST /wmdrest/article/get-price`
- `POST /wmdrest/article/get-options`
- `POST /wmdrest/article/get-sorten-auflage`
- `POST /wmdrest/article/get-splitted-sorten-options`
- `POST /wmdrest/article/print-template`

## Key request contract discovered

- `articleId`: `54008`
- `categoryId`: `20649`
- selected material (`substrateId`) from `#sorten`
- width/height from `#grossdruck_width` / `#grossdruck_height`
- quantity from `#menge_input`
- delivery options observed:
  - `STANDARD_PRODUCTION`
  - `1`
  - `13`
- required token from hidden field:
  - `input[name="_token"]`

## Sample get-price response fields used

- `data.response.currency` (`EUR`)
- `data.response.basePrice`
- `data.response.deliveryCharge`
- `data.response.price` (net)
- `data.response.priceWithTax`
- `data.response.priceScaleId`
- `data.response.priceModel` (`m2`)

## Script added

- `scripts/fetch2-wmd-roll-labels.mjs`
  - command `probe`
  - command `extract`
  - command `import` (additive storformat import for a single target slug)
  - output: JSON + CSV + summary CSV
  - conversion default: `EUR*7.6`, +70% or +60% above 3000 DKK base
  - base source for conversion: supplier net (`data.response.price`)

## Import validation

Dry-run command executed:
- `node scripts/fetch2-wmd-roll-labels.mjs import --dry-run --input pricing_raw/wmd-roll-labels-free-size-2026-02-25T08-20-14-063Z.json`

Dry-run summary confirmed:
- product slug default: `wmd-roll-labels-free-size`
- mode: `both` (cheapest base + fast-delivery surcharge option)
- parsed rows: `4` (sample file)
- material tiers generated: `4`
- product variants generated: `2`

## Skill added

- `.agent/skills/fetch2/SKILL.md`

## Notes

- Implementation is additive only.
- Existing pricing/rendering logic is untouched.
