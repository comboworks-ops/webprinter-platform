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

Quick Do/Don't checklist:

Do:
- Preserve POD v1 flows and tables.
- Keep POD v2 changes additive and versioned.
- Follow delete order for POD v2 data (imports -> fulfillment jobs -> catalog products).
- Treat pricing as read-only unless given explicit permission.
- Document new edges/functions in `POD2_README.md`.

Don't:
- Modify existing pricing logic, schemas, or calculations without approval.
- Reuse POD v1 tables for POD v2.
- Hard-delete shared data or change tenant scoping.
- Ship schema or edge changes without a short rollback note.
