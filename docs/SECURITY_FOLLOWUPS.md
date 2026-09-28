# Security Follow-ups

Last updated: 2026-09-16

## Open Items

### 2026-02-19 — Supabase service-role key rotation
- Context: A `SUPABASE_SERVICE_ROLE_KEY` value was shared in chat while debugging imports.
- Risk: Service-role key grants elevated DB access and should be treated as compromised once exposed.
- Status: `OPEN` — 16 September read-only verification found the configured live service-role JWT is still valid (issued 8 December 2025; Auth admin endpoint HTTP 200). No secret value was printed. See `docs/PRODUCTION_KEY_REPLACEMENT.md`.

#### Required actions
1. Migrate consumers to existing modern API keys; current Supabase guidance no
   longer supports legacy key rotation. Follow `PRODUCTION_KEY_REPLACEMENT.md`.
2. Replace local script credentials and update deployed Edge Function consumers.
3. Update browser/Vercel configuration and actual CI/scheduled secret consumers.
4. Validate imports and shop/Auth/checkout paths, then disable legacy API keys
   and prove the exposed old key is rejected. Admin passwords remain separate.
5. Revoke any temporary RLS import workarounds if present.

#### Verification checklist
- [ ] New key works for `scripts/fetch-folders-import.js` import flow.
- [ ] No old key remains in `.env`, shell history, or secret manager entries.
- [ ] No broad temporary RLS policies remain enabled.
