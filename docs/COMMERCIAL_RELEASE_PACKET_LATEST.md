# Commercial Release Packet Index

Generated: 2026-07-10T01:28:30.907Z
Git status command: `git status --short --branch`
Git staged command: `git diff --cached --name-status`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 1]
Status: HOLD

This is a local, read-only release packet index artifact. It does not stage, unstage, commit, push, pull, merge, rebase, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Executive Snapshot

Release proof: PASS
Tenant browser proof: PASS
Staged packet: PASS
Staged entries: 0
Branch behind remote: no
Unresolved upstream overlaps: 0
Owner merge simulation: PASS
Deploy readiness: HOLD
Staged file drift: 0
Release-impacting unstaged files: 0
Unstaged/untracked outside packet: 295
Supabase staged files: 0

## Report Index

| State | Area | Report | Command | Why open it |
| --- | --- | --- | --- | --- |
| PASS | Release proof | docs/COMMERCIAL_RELEASE_LATEST.md | npm run check:commercial-release-report | Confirms the full proof/build gate passed. |
| PASS | Tenant browser proof | docs/COMMERCIAL_PROOF_LATEST.md | npm run check:commercial-proof-report | Shows Webprinter, site package preview, Salgsmapper and Onlinetryksager proof routes. |
| REVIEW | Changeset review | docs/COMMERCIAL_CHANGESET_LATEST.md | npm run check:commercial-changeset-report | Groups the dirty worktree into review buckets. |
| REVIEW | Application source | docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md | npm run check:commercial-application-source-report | Separates runtime app changes from pricing/POD guardrails. |
| REVIEW | Supabase scope | docs/COMMERCIAL_SUPABASE_LATEST.md | npm run check:commercial-supabase-report | Shows grant/function checks plus migration/function deployment scope. |
| PASS | Staged packet | docs/COMMERCIAL_STAGED_PACKET_LATEST.md | npm run check:commercial-staged-packet-report | Proves forbidden local/debug artifacts are not staged. |
| REVIEW | Branch freshness | docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md | npm run check:commercial-branch-freshness-report | Makes the upstream-only commit and staged overlap visible. |
| HOLD | Upstream reconciliation | docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md | npm run check:commercial-upstream-reconciliation-report | Shows remote overlap is exact, represented or superseded. |
| HOLD | Owner merge-readiness | docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md | npm run check:commercial-owner-merge-readiness-report | Proves the staged packet overlays on the upstream tree. |
| HOLD | Release-owner sequence | docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md | npm run check:commercial-release-owner-sequence-report | Gives the human branch, commit and deploy sequence. |
| HOLD | Deploy readiness | docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md | npm run check:commercial-deploy-readiness-report | Summarizes push/deploy holds and owner decisions. |
| HOLD | Release handoff | docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md | npm run check:commercial-release-handoff-report | Contains commit suggestion, rollback note and smoke routes. |

## Current Holds

- HOLD: Upstream reconciliation is HOLD with 0 unresolved overlap(s).
- HOLD: Supabase scope is REVIEW REQUIRED before DB/function deploy.
- HOLD: Release-owner sequence is HOLD until branch/commit/deploy owner work is done.
- HOLD: Deploy readiness is HOLD until push/deploy ownership decisions are made.
- HOLD: Release handoff is HOLD until the human owner executes the release sequence.
- HOLD: 295 unstaged/untracked entries remain outside the staged packet.

## Owner Stop Rules

- Open this packet first, then open `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md` for the operational release sequence.
- Do not push or deploy until the branch is freshened by the release owner.
- Do not deploy Supabase migration/functions without explicit owner approval.
- Rerun `npm run check:commercial-release` and `npm run check:commercial-release-packet:write` after branch freshness changes.
- Stop if tenant browser proof, staged-packet guard, owner merge simulation, Supabase exposure or Supabase grants fail.

## Operator Commands

```sh
npm run check:commercial-release
npm run check:commercial-release-packet:write
npm run check:commercial-release-packet-report
npm run check:commercial-release-handoff-report
git diff --cached --check
```
