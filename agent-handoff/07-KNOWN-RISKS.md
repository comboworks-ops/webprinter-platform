# Known Risks

## 1. Site Designer / Branding Runtime Mismatch

- V2 editor features exist
- not every control is guaranteed to be fully wired into live storefront runtime
- preview, draft, and publish flows must be tested after changes

## 2. Pricing Is Central And Sensitive

- pricing touches storefront correctness directly
- matrix rendering and published prices must not be refactored casually
- pricing changes have broad blast radius

## 3. POD v1 / POD v2 Boundary Risk

- both systems exist
- they must not be blended
- changes in one POD system should not leak into the other

## 4. `technical_specs` Is Powerful But Easy To Overload

- product-specific extensions, site mappings, product-page info, and special runtime flags may all live there
- changes must be explicit and reversible

## 5. Sites Are Real But Still Evolving

- `Sites` now has activation, product mapping, and live handoff
- the future large-scale model is still planned, not fully built
- do not treat site packages as a finished independent platform

## 6. Domain / Live Address Logic

- custom domain is cleaner than inferred subdomain behavior
- some domain behavior is runtime-derived, not fully persisted as dedicated columns

## 7. Large UI Surface

- admin contains many domains in one shell
- a seemingly local UI change can affect a critical flow indirectly

## 8. Heavy Build / Runtime Footprint

- the app is large
- build warnings already indicate oversized chunks and mixed import patterns
- optimization work should be deliberate, not opportunistic
