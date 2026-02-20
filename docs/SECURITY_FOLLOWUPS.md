# Security Follow-ups

Last updated: 2026-02-19

## Open Items

### 2026-02-19 — Supabase service-role key rotation
- Context: A `SUPABASE_SERVICE_ROLE_KEY` value was shared in chat while debugging imports.
- Risk: Service-role key grants elevated DB access and should be treated as compromised once exposed.
- Status: `OPEN`

#### Required actions
1. Rotate the service-role key in Supabase project settings.
2. Replace local `.env` value for `SUPABASE_SERVICE_ROLE_KEY`.
3. Update CI/CD or deployment secrets if this key is used outside local dev.
4. Validate import scripts still work with the new key.
5. Revoke any temporary RLS import workarounds if present.

#### Verification checklist
- [ ] New key works for `scripts/fetch-folders-import.js` import flow.
- [ ] No old key remains in `.env`, shell history, or secret manager entries.
- [ ] No broad temporary RLS policies remain enabled.

