# Agent Guide (Repo Entry)

This repo uses a few high-priority docs to avoid breaking production logic. Read these first in order:

1) POD v2 rules and safeguards: `POD2_README.md`
2) Project continuity: `AI_CONTINUITY.md`
3) System overview: `SYSTEM_OVERVIEW.md`
4) Handover notes: `.agent/HANDOVER.md`

General expectations:
- Do not change existing pricing or POD v1 logic unless explicitly instructed.
- Prefer additive changes; avoid destructive DB changes.
- If a task mentions POD v2, follow `POD2_README.md` strictly.
- Do not introduce major workflow/UI architecture changes (for example replacing manual product creation flow) without explicit user approval first.
- For Pixart wide-format imports, use `.agent/skills/pixart/SKILL.md` and `scripts/fetch-pixart-flat-surface-adhesive-import.mjs` (do not create a parallel import flow).
- For t-shirt imports with size distribution, use `.agent/skills/tshirt-fetch/SKILL.md` and keep scope limited to t-shirt products.

Quick Do/Don't checklist:

Do:
- Preserve POD v1 flows and tables.
- Keep POD v2 changes additive and versioned.
- Follow delete order for POD v2 data (imports -> fulfillment jobs -> catalog products).
- Treat pricing as read-only unless given explicit permission.
- Document new edges/functions in `POD2_README.md`.
- Ask before changing core creation flows, input models, or publishing behavior.

Don't:
- Modify existing pricing logic, schemas, or calculations without approval.
- Reuse POD v1 tables for POD v2.
- Hard-delete shared data or change tenant scoping.
- Ship schema or edge changes without a short rollback note.
