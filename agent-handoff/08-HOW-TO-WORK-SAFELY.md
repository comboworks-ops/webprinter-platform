# How To Work Safely

## Non-Negotiable Rules

- do not change pricing logic unless explicitly asked
- do not break POD v1
- do not merge POD v1 and POD v2 concerns
- prefer additive changes
- verify draft / preview / publish flows after branding or site changes

## Safe Working Order

1. identify the domain
2. check whether it touches a critical flow
3. confirm what the domain owns
4. make the smallest additive change possible
5. run validation
6. document anything non-obvious

## Before Editing

Check:

- `docs/CRITICAL_FLOWS.md`
- `docs/DOMAIN_CONTRACTS.md`
- `docs/API_ROLLOUT_PLAN.md`
- `POD2_README.md` when POD v2 is involved

## Preferred Change Types

- additive UI exposure of existing logic
- documentation and boundary clarification
- safe helper functions
- isolated route or admin improvements
- explicit site/product mappings

## High-Risk Change Types

- pricing calculation logic
- tenant resolution logic
- product visibility rules
- draft/publish behavior
- POD data model changes
- broad refactors in admin shell

## Validation Checklist

At minimum:

- page loads
- no new console/runtime failure
- build still passes
- affected admin page still saves
- affected storefront page still renders

If branding/site-related:

- preview still loads
- saved changes still reload
- publish path still works

If pricing-related:

- matrix still renders
- price updates still respond correctly
- no query failures on product price reads
