# Commercial Deploy Readiness Report

Generated: 2026-07-10T01:28:30.483Z
Git status command: `git status --short --branch`
Git staged command: `git diff --cached --name-status`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 1]
Status: HOLD

This is a local, read-only deploy-readiness artifact. It does not stage, unstage, commit, push, pull, merge, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Decision Summary

Deploy readiness: HOLD
Staged entries: 0
Total dirty entries: 299
Release-impacting unstaged files: 0
Branch behind remote: no
Branch ahead of remote: yes

## Readiness Checks

| Status | Check | Evidence | Next action |
| --- | --- | --- | --- |
| PASS | Release proof | Latest commercial release report is present and shows Status: PASSED. | Keep report with the packet. |
| PASS | Staged packet safety | Staged report shows 0 forbidden staged files. | Keep held artifacts outside the staged packet. |
| PASS | Staged diff hygiene | git diff --cached --check passed. | No whitespace/path cleanup needed in staged packet. |
| PASS | Branch freshness report | Branch report shows Status: READY; overlaps with staged packet: 0. | No upstream-only overlap is visible from the branch report. |
| HOLD | Upstream reconciliation report | Reconciliation shows Status: HOLD; unresolved overlaps: 0. | Remote overlap is represented/superseded locally; branch still needs owner-controlled merge/rebase before push/deploy. |
| HOLD | Owner merge-readiness report | Owner merge-readiness shows Status: HOLD; merge simulation: PASS. | Staged packet can be preserved on the upstream tree; release owner still performs the actual merge/rebase and reruns the release gate. |
| HOLD | Release-owner sequence report | Release-owner sequence shows Status: HOLD; owner merge simulation: PASS. | Use the ordered owner sequence after branch freshness, then rerun the commercial release gate. |
| PASS | Branch freshness | ## ui-cleanup...origin/ui-cleanup [ahead 1] | Branch is not reported behind remote. |
| PASS | Release-impacting unstaged source/config | No release-impacting unstaged source/config files outside the staged packet. | The staged packet matches the release-impacting app/config worktree. |
| HOLD | Unstaged worktree outside packet | 299 unstaged/untracked entries are visible outside the staged packet. | Commit/push only the staged packet, or separately classify/clean local leftovers before any local deploy. |
| HOLD | Held high-risk local artifacts | supabase/.temp/cli-latest, .agents/, .codex/, deno.lock, supabase/config 2.toml, supabase/functions/test-env/index 2.ts | Keep these files unstaged unless explicitly approved: Supabase temp/config/debug artifacts and local tooling. |
| PASS | Deployable Supabase scope | No staged Supabase files. | No Supabase deploy step needed for this packet. |
| HOLD | Push/deploy ownership | This report does not create commits, pushes, Vercel deployments or Supabase deployments. | A human operator still chooses commit message, push target, Vercel deploy path, Supabase migration/function deploy path and rollback note. |

## Required Next Actions Before Push/Deploy

- Upstream reconciliation report: Remote overlap is represented/superseded locally; branch still needs owner-controlled merge/rebase before push/deploy.
- Owner merge-readiness report: Staged packet can be preserved on the upstream tree; release owner still performs the actual merge/rebase and reruns the release gate.
- Release-owner sequence report: Use the ordered owner sequence after branch freshness, then rerun the commercial release gate.
- Unstaged worktree outside packet: Commit/push only the staged packet, or separately classify/clean local leftovers before any local deploy.
- Held high-risk local artifacts: Keep these files unstaged unless explicitly approved: Supabase temp/config/debug artifacts and local tooling.
- Push/deploy ownership: A human operator still chooses commit message, push target, Vercel deploy path, Supabase migration/function deploy path and rollback note.

## Operator Commands

```sh
npm run check:commercial-release
npm run check:commercial-owner-merge-readiness:write
npm run check:commercial-release-owner-sequence:write
npm run check:commercial-deploy-readiness:write
npm run check:commercial-deploy-readiness-report
git diff --cached --check
```
