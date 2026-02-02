# Agent Guide (Repo Entry)

This repo uses a few high-priority docs to avoid breaking production logic. Read these first in order:

1) **SAFETY AUDIT**: `.agent/SAFETY_AUDIT_2026-02-01.md` ← START HERE (lists protected files + known bugs)
2) POD v2 rules and safeguards: `POD2_README.md`
3) Project continuity: `AI_CONTINUITY.md`
4) System overview: `SYSTEM_OVERVIEW.md`
5) Handover notes: `.agent/HANDOVER.md`
6) Protected workflows: `.agent/workflows/*.md`

## Architecture Boundaries

Before making changes, check `docs/ARCHITECTURE_BOUNDARIES.md` to understand which domain you're working in.

**Domain-specific skills** (use these for guided checklists):
- `/pricing-change` - Safe pricing system modifications
- `/designer-change` - Safe print designer modifications
- `/branding-change` - Safe branding system modifications

**Backup skills** (use before risky changes):
- `/backup` - Create a git tag backup before changes
- `/restore` - Restore from a backup tag

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
