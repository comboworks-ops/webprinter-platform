# Open Design Shop Contract

## Goal

Turn Site Design V2 shop choices into complete, visibly different storefront
systems while preserving each tenant's catalogue, prices, content and brand
settings.

## Evidence

The implementation uses design-system patterns studied from Open Design's
clean, minimal, corporate, warm-editorial, Shopify, dramatic, premium and
neobrutalism systems. Open Design is used as reference material and a design
contract, not as runtime React code.

Each of the ten local templates resolves to a typed component recipe covering
header, dropdown, category navigation, product collection, product card,
product page, checkout, footer and motion. The browser QA confirmed that the
Takeaway recipe resolved through all of these surfaces and that the classic
recipe could be restored without saving or publishing.

## Confidence

- High: template resolution, fallback behaviour and recipe completeness.
- High: draft-only selection and preservation of product and pricing data.
- High: desktop and embedded narrow-viewport overflow checks.
- Medium: every tenant's custom content combination, which still needs normal
  tenant-by-tenant visual acceptance before publishing.

## Keep

- Existing branding draft and publish flow.
- Existing product catalogue, pricing and checkout components.
- Existing tenant colours, fonts, copy, images and feature flags.
- One versioned template registry with a classic fallback.

## Change

- Shop templates now alter actual component anatomy and journey composition.
- Product-menu layout can be selected independently from the shop recipe.
- Template miniatures communicate header alignment and catalogue density.
- Product and checkout surfaces expose stable recipe hooks for controlled CSS.

## Do Not Copy

- Do not copy Open Design application code, remote components or product
  assumptions into Webprinter.
- Do not introduce an untrusted component loader.
- Do not bind recipe selection to pricing, publishing or product mutations.
- Do not duplicate existing site-type business logic inside the design layer.

## Risks

- Extremely customised legacy branding can conflict with a recipe's intended
  spacing; preview before publishing.
- A new product or checkout component must include the existing semantic recipe
  hooks to receive the full design.
- Browser support for `color-mix()` should be part of the production browser
  baseline; colours still retain usable token-backed fallbacks.

## Quality Gate

1. Unit tests resolve all ten complete recipes and the classic fallback.
2. Production build succeeds.
3. Homepage, product flow and checkout render without horizontal overflow.
4. Product/menu selection remains keyboard accessible.
5. Recipe preview does not mutate catalogue, pricing, tenant or POD data.
6. Only the existing publish action can make a draft recipe live.
