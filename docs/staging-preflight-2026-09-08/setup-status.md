# Staging setup progress — 8 September 2026

This follow-up implements the user's request to try establishing the isolated
test environment. No infrastructure has been created yet, no deployment has
been made, and no production settings or data have been changed.

## Hosting access works through the existing CLI login

The Vercel connector still returns 403 for the linked project. The already
installed Vercel CLI 56.3.2 uses a separate, working login. `whoami` succeeded,
and `project inspect printmaker-web-craft-main --scope
team_nmuMQas8BCWeDkJKfxxMv3Ab` returned the exact expected project
`prj_TtU0kZ4gkQ505dpNiNuOdnBBzmCx`, owned by Thomas' projects, using Vite and
Node 24.x. No relink, permission change, token export or login replacement was
needed. Connector access itself has not been repaired.

A staging deployment can use the working CLI. A separate project is proposed
so its browser and server environment settings can be explicitly isolated.
Do not change existing production/preview environment values to achieve this.

## Database provisioning decision is pending

The connected Supabase organisation inventory contains `yebbo project`
(`ywwazrdktvdrmaspkvuf`), which owns the current Webprinter project. The user
has been asked which billing organisation to use. The Supabase `get_cost`
tool explicitly requires that choice; it also requires the quoted cost to be
repeated and confirmed before resource creation. No cost quote or resource
creation has been requested while that choice remains unanswered.

Proposed database: a persistent, schema-only staging branch of the existing
project, with no customer/business data or production Storage objects copied.
Supabase documents separate branch instances and credentials, and recommends
persistent branches for staging. It also documents branch-specific secrets.
[Branching](https://supabase.com/docs/guides/deployment/branching),
[branch configuration](https://supabase.com/docs/guides/deployment/branching/configuration).

Branch creation alone will not establish a valid baseline. Read-only metadata
inspection found 145 hosted migration-history entries, including 28 with
empty/null statements. Stored migration statements do not mention the live
`order_files` relation or `handle_new_user_signup` function. Supabase documents
that dashboard branching can initialize from migration history. Verify the
new branch's actual tables, columns, grants, RLS, functions and triggers before
applying the six repairs. If necessary, prepare and review a schema-only
baseline export; do not copy business records as a workaround.
[Dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard).

## Initial fixture and effects controls

- Verify any cloned outbound schedules are absent or disabled before seeding.
  Main currently has an active `pod2-printcom-sync-status` schedule every
  20 minutes. Do not alter that production schedule.
- Keep new checkout and order email disabled during setup. Configure only
  branch-scoped service credentials and Stripe test credentials later.
- Create a synthetic master sentinel and two visibly different test shops,
  two ordinary owners and two customers. No supplier connections, POD product
  links or automatic forwarding belong in these fixtures.
- Create fixture users without `shop_name` metadata. The current live signup
  trigger creates an unscoped admin role when that metadata is present and
  swallows errors. Assign staging ownership/scoped roles explicitly, and
  verify that customer A/B have no operator privileges.
- Seed only complete staging products/prices, including same-slug products
  in different shops with distinct IDs/prices. Existing business prices remain
  untouched. Verify catalog/pricing read functions as well as the five repairs.
- Recreate only required Storage bucket rows and upload synthetic files.
  Current approved-file reading requires the existing public `order-files`
  bucket contract. Generate accepted orders/files/mail via real test flows,
  not pre-seeded success records.

The available in-app browser reaches Stripe's login page. No Stripe dashboard
configuration or credentials have been accessed, and no payment was attempted.
Authenticated Stripe test setup and controlled test inbox selection remain
later steps.

The original `backend-manifest.json` remains the earlier source/metadata
snapshot; its connector-403 field is historical, not a claim that all hosting
access remains blocked.

## Frontend candidate built locally

The isolated candidate contains 1,077 current source/config/asset files. Its
local Vite production build passed and produced 260 output files, with original
and copied source hashes unchanged. No `.env`, `.vercel` or Git metadata was
copied. The build used an inert `.invalid` backend URL and dummy public key;
it must be rebuilt with verified staging public configuration before deployment.

The matching pnpm lockfile was retained; the stale npm lockfile was excluded
from the copy. A clean dependency install is not yet verified, and existing
pnpm build-policy placeholders need review before choosing the hosted install
command. API execution, TypeScript cleanliness and hosted browser behavior
remain unverified. See [the full candidate report](frontend-candidate.json).
