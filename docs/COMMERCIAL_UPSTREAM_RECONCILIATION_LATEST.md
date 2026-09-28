# Commercial Upstream Reconciliation Report

Generated: 2026-07-10T01:28:29.799Z
Git status command: `git status --short --branch`
Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 1]
Upstream: origin/ui-cleanup
Status: HOLD

This is a local, read-only upstream reconciliation artifact. It does not fetch, pull, rebase, merge, stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Reconciliation Summary

Local HEAD: 554dcd6
Remote commits: 0
Remote changed files: 126
Staged packet files: 0
Exact overlaps: 0
Represented overlaps: 0
Superseded overlaps: 0
Unresolved overlaps: 0
Remote-only files: 126

## Remote Commits

- No upstream-only commits are visible from the current local refs.

## Overlap Reconciliation

| State | Remote status | Path | Evidence |
| --- | --- | --- | --- |
| none | none | `none` | No upstream/staged overlap is visible. |

## Required Owner Review

- HOLD: 126 upstream changed file(s) are not in the staged packet.
- Do not push or deploy until the upstream commit is merged/rebased by the release owner.
- Rerun the full commercial release gate after branch freshness changes.

## Operator Commands

```sh
git log --oneline HEAD..origin/ui-cleanup
git diff --name-status HEAD..origin/ui-cleanup
npm run check:commercial-upstream-reconciliation:write
```
