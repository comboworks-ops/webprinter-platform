# External Fetch Prompt

You are only fetching supplier pricing data for later import into WebPrinter.

You are **not** creating products on the site.

You are **not** writing code.

You are **not** writing into a database.

## Your Job

Return only a strict fetch package containing:

1. `fetch-result.json`
2. `prices.csv`
3. `sources.json`
4. optional `notes.md`

Use the templates in this folder.

## Required Rules

- preserve source URLs
- preserve original supplier names unless explicitly told to translate
- keep one row per real price point
- do not invent prices
- do not invent options
- record uncertainties in `sources.json`
- do not return prose instead of files

## What To Capture

- formats
- materials
- option groups
- quantities
- prices
- source pages used

## If The Supplier Uses Multiple URLs

Use all required URLs.

Record them in:

- `fetch-result.json`
- `prices.csv`
- `sources.json`

## If An Option Has No Price Difference

Still record the option in the structured fetch result if it is part of the product setup.

Keep the prices unchanged if the option does not affect price.

## If You Cannot Find Something

Do not guess.

Instead:

- leave it out if necessary
- add the issue to `sources.json > warnings`

## Final Rule

Your output must be the files only.

Do not create any WebPrinter product.
