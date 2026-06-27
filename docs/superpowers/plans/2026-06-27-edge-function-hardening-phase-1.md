# Edge Function Hardening Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Supabase Edge Function exposure explicit and safely quarantine local/dev-only service-role functions without changing pricing, POD v1, POD v2, or checkout behavior.

**Architecture:** Add small shared Edge Function helpers for consistent JSON responses, verified user/role checks, and local-only function guards. Apply them first to low-surface helper/admin functions, then add a repo-level static checker so future functions cannot drift silently.

**Tech Stack:** Supabase Edge Functions on Deno, TypeScript, `@supabase/supabase-js@2`, Node script for static repo checks, existing `npm run check:supabase-grants` pattern.

## Global Constraints

- Do not change existing pricing logic, schemas, or calculations.
- Do not change POD v1 behavior.
- Keep POD v2 changes additive and separate from POD v1.
- Do not deploy `designer-pdf-service` until auth, size limits, and ownership checks exist.
- Do not delete tracked duplicate files or backup folders in this phase.
- Do not rely on client-provided admin status or caller-supplied user headers.
- Every deployed Supabase function must have an explicit exposure decision in repo docs or config.

---

## File Structure

- Create `supabase/functions/_shared/http.ts`
  - Shared CORS and JSON response helpers for Edge Functions.
- Create `supabase/functions/_shared/auth.ts`
  - Shared verified-user and role-check helpers.
- Create `supabase/functions/_shared/localOnly.ts`
  - Shared local/dev-only guard for seed/setup/test/admin bootstrap functions.
- Modify `supabase/functions/verify-admin/index.ts`
  - Use shared auth helper and return master-admin-aware result.
- Modify `supabase/functions/create-admin-user/index.ts`
  - Require local/dev guard and master-admin auth before using Auth admin APIs.
- Modify `supabase/functions/seed-folder-prices/index.ts`
  - Require local/dev guard before service-role writes.
- Modify `supabase/functions/seed-generic-prices/index.ts`
  - Require local/dev guard before service-role writes.
- Modify `supabase/functions/seed-product-prices/index.ts`
  - Require local/dev guard before service-role deletes/upserts.
- Modify `supabase/functions/setup-schema/index.ts`
  - Require local/dev guard before schema/policy creation.
- Modify `supabase/functions/test-env/index.ts`
  - Require local/dev guard and never return raw secret values.
- Modify `supabase/config.toml`
  - Add explicit `verify_jwt` entries for local/dev-only and public functions touched in this phase.
- Create `scripts/check-supabase-function-exposure.js`
  - Static checker for explicit function exposure and local-only guard usage.
- Modify `package.json`
  - Add `check:supabase-functions`.
- Modify `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`
  - Mark Phase 1 functions as guarded after implementation.

---

### Task 1: Shared Edge Function HTTP and Auth Helpers

**Files:**
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/functions/_shared/auth.ts`

**Interfaces:**
- Produces:
  - `corsHeaders: Record<string, string>`
  - `jsonResponse(payload: unknown, status?: number): Response`
  - `methodNotAllowed(): Response`
  - `requireUser(req: Request): Promise<AuthResult>`
  - `requireRole(req: Request, allowedRoles: string[], tenantId?: string): Promise<RoleResult>`

- [ ] **Step 1: Create `supabase/functions/_shared/http.ts`**

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsResponse(): Response {
  return new Response("ok", { headers: corsHeaders });
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: "Method not allowed" }, 405);
}
```

- [ ] **Step 2: Create `supabase/functions/_shared/auth.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

export type VerifiedUser = {
  id: string;
  email?: string;
};

export type AuthResult =
  | { ok: true; user: VerifiedUser; authHeader: string }
  | { ok: false; response: Response };

export type RoleResult =
  | { ok: true; user: VerifiedUser; roles: Array<{ role: string; tenant_id: string | null }> }
  | { ok: false; response: Response };

export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return { ok: true, authHeader, user: { id: user.id, email: user.email ?? undefined } };
}

export async function requireRole(
  req: Request,
  allowedRoles: string[],
  tenantId?: string,
): Promise<RoleResult> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: roles, error } = await serviceClient
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", auth.user.id);

  if (error) {
    return { ok: false, response: jsonResponse({ error: "Could not verify role" }, 500) };
  }

  const normalizedRoles = (roles || []) as Array<{ role: string; tenant_id: string | null }>;
  const isAllowed = normalizedRoles.some((entry) => {
    if (!allowedRoles.includes(entry.role)) return false;
    if (entry.role === "master_admin") return true;
    return !tenantId || entry.tenant_id === tenantId;
  });

  if (!isAllowed) {
    return { ok: false, response: jsonResponse({ error: "Forbidden" }, 403) };
  }

  return { ok: true, user: auth.user, roles: normalizedRoles };
}
```

- [ ] **Step 3: Verify helper files are importable**

Run:

```bash
npx supabase functions serve verify-admin --no-verify-jwt
```

Expected:

```text
Serving functions on http://127.0.0.1:54321/functions/v1
```

Stop the local serve process after confirming it starts.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/http.ts supabase/functions/_shared/auth.ts
git commit -m "chore: add shared edge function auth helpers"
```

---

### Task 2: Local-Only Guard for Dev/Admin Bootstrap Functions

**Files:**
- Create: `supabase/functions/_shared/localOnly.ts`

**Interfaces:**
- Consumes:
  - `jsonResponse(payload: unknown, status?: number): Response`
- Produces:
  - `requireLocalOnly(req: Request): Response | null`

- [ ] **Step 1: Create `supabase/functions/_shared/localOnly.ts`**

```ts
import { jsonResponse } from "./http.ts";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function envFlag(name: string): boolean {
  return TRUE_VALUES.has(String(Deno.env.get(name) || "").toLowerCase());
}

export function requireLocalOnly(req: Request): Response | null {
  const allowLocalTools = envFlag("ALLOW_LOCAL_DEV_FUNCTIONS");
  const deploymentEnv = String(Deno.env.get("DEPLOYMENT_ENV") || Deno.env.get("ENVIRONMENT") || "").toLowerCase();
  const configuredSecret = Deno.env.get("LOCAL_FUNCTION_SECRET") || "";
  const providedSecret = req.headers.get("x-local-function-secret") || "";

  if (!allowLocalTools) {
    return jsonResponse({ error: "Function disabled" }, 403);
  }

  if (deploymentEnv === "production" || deploymentEnv === "prod") {
    return jsonResponse({ error: "Function disabled in production" }, 403);
  }

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  return null;
}
```

- [ ] **Step 2: Verify no secret values are returned by the guard**

Run:

```bash
rg -n "LOCAL_FUNCTION_SECRET|ALLOW_LOCAL_DEV_FUNCTIONS|DEPLOYMENT_ENV" supabase/functions/_shared/localOnly.ts
```

Expected:

```text
supabase/functions/_shared/localOnly.ts:...
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/localOnly.ts
git commit -m "chore: add local-only edge function guard"
```

---

### Task 3: Harden Admin Verification and Admin Bootstrap

**Files:**
- Modify: `supabase/functions/verify-admin/index.ts`
- Modify: `supabase/functions/create-admin-user/index.ts`

**Interfaces:**
- Consumes:
  - `requireUser(req)`
  - `requireRole(req, ["master_admin"])`
  - `requireLocalOnly(req)`
- Produces:
  - `verify-admin` response: `{ isAdmin: boolean; isMasterAdmin: boolean; userId?: string; error?: string }`
  - `create-admin-user` remains local/dev-only and master-admin-only.

- [ ] **Step 1: Replace `verify-admin` with shared role logic**

Use this full file content:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles, error } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id);

    if (error) {
      return jsonResponse({ isAdmin: false, isMasterAdmin: false, error: "Could not verify role" }, 500);
    }

    const roleNames = (roles || []).map((entry: any) => entry.role);
    const isMasterAdmin = roleNames.includes("master_admin");
    const isAdmin = isMasterAdmin || roleNames.includes("admin");

    return new Response(
      JSON.stringify({ isAdmin, isMasterAdmin, userId: auth.user.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verify admin failed";
    return jsonResponse({ isAdmin: false, isMasterAdmin: false, error: message }, 500);
  }
});
```

- [ ] **Step 2: Add local/dev and master-admin gates to `create-admin-user`**

At the top of `supabase/functions/create-admin-user/index.ts`, add:

```ts
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireRole } from "../_shared/auth.ts";
import { requireLocalOnly } from "../_shared/localOnly.ts";
```

Inside the request handler, immediately after the `OPTIONS` branch, add:

```ts
const localOnlyError = requireLocalOnly(req);
if (localOnlyError) return localOnlyError;

const role = await requireRole(req, ["master_admin"]);
if (!role.ok) return role.response;
```

Replace ad hoc JSON error responses in this function with `jsonResponse(...)`.

- [ ] **Step 3: Verify static imports**

Run:

```bash
rg -n "requireLocalOnly|requireRole|jsonResponse|optionsResponse" supabase/functions/create-admin-user/index.ts supabase/functions/verify-admin/index.ts
```

Expected:

```text
supabase/functions/create-admin-user/index.ts:...
supabase/functions/verify-admin/index.ts:...
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/verify-admin/index.ts supabase/functions/create-admin-user/index.ts
git commit -m "fix: gate admin bootstrap edge functions"
```

---

### Task 4: Quarantine Local/Dev Seed, Setup, and Env Functions

**Files:**
- Modify: `supabase/functions/seed-folder-prices/index.ts`
- Modify: `supabase/functions/seed-generic-prices/index.ts`
- Modify: `supabase/functions/seed-product-prices/index.ts`
- Modify: `supabase/functions/setup-schema/index.ts`
- Modify: `supabase/functions/test-env/index.ts`

**Interfaces:**
- Consumes:
  - `requireLocalOnly(req): Response | null`
  - `jsonResponse(payload, status?)`
  - `optionsResponse()`

- [ ] **Step 1: Add the local-only imports to each function**

At the top of each listed file, add:

```ts
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireLocalOnly } from "../_shared/localOnly.ts";
```

- [ ] **Step 2: Add the guard immediately after CORS handling**

Inside each `Deno.serve` or `serve` handler, immediately after the `OPTIONS`
branch, add:

```ts
const localOnlyError = requireLocalOnly(req);
if (localOnlyError) return localOnlyError;
```

- [ ] **Step 3: Make `test-env` return presence booleans only**

Replace any raw environment value output in `supabase/functions/test-env/index.ts`
with this response shape:

```ts
return jsonResponse({
  FLYERALARM_DEMO_TOKEN: Boolean(Deno.env.get("FLYERALARM_DEMO_TOKEN")),
  SUPABASE_URL: Boolean(Deno.env.get("SUPABASE_URL")),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
});
```

- [ ] **Step 4: Verify local-only guard coverage**

Run:

```bash
for f in \
  supabase/functions/seed-folder-prices/index.ts \
  supabase/functions/seed-generic-prices/index.ts \
  supabase/functions/seed-product-prices/index.ts \
  supabase/functions/setup-schema/index.ts \
  supabase/functions/test-env/index.ts; do
  rg -n "requireLocalOnly\\(req\\)" "$f" || exit 1
done
```

Expected:

```text
supabase/functions/seed-folder-prices/index.ts:...
supabase/functions/seed-generic-prices/index.ts:...
supabase/functions/seed-product-prices/index.ts:...
supabase/functions/setup-schema/index.ts:...
supabase/functions/test-env/index.ts:...
```

- [ ] **Step 5: Commit**

```bash
git add \
  supabase/functions/seed-folder-prices/index.ts \
  supabase/functions/seed-generic-prices/index.ts \
  supabase/functions/seed-product-prices/index.ts \
  supabase/functions/setup-schema/index.ts \
  supabase/functions/test-env/index.ts
git commit -m "fix: quarantine local-only edge functions"
```

---

### Task 5: Add Function Exposure Static Checker

**Files:**
- Create: `scripts/check-supabase-function-exposure.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - CLI command: `npm run check:supabase-functions`

- [ ] **Step 1: Create `scripts/check-supabase-function-exposure.js`**

```js
#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const functionsDir = path.join(root, "supabase", "functions");
const configPath = path.join(root, "supabase", "config.toml");

const localOnlyFunctions = new Set([
  "create-admin-user",
  "seed-folder-prices",
  "seed-generic-prices",
  "seed-product-prices",
  "setup-schema",
  "test-env",
]);

const functionNames = fs
  .readdirSync(functionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

const config = fs.readFileSync(configPath, "utf8");
const failures = [];

for (const functionName of functionNames) {
  const sectionPattern = new RegExp(`\\[functions\\.${functionName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\]`);
  if (!sectionPattern.test(config)) {
    failures.push(`${functionName}: missing explicit [functions.${functionName}] config section`);
  }
}

for (const functionName of localOnlyFunctions) {
  const indexPath = path.join(functionsDir, functionName, "index.ts");
  const source = fs.readFileSync(indexPath, "utf8");
  if (!source.includes("requireLocalOnly(req)")) {
    failures.push(`${functionName}: missing requireLocalOnly(req) guard`);
  }
}

if (failures.length > 0) {
  console.error("Supabase function exposure check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Supabase function exposure check passed for ${functionNames.length} functions.`);
```

- [ ] **Step 2: Add the package script**

In `package.json`, add:

```json
"check:supabase-functions": "node scripts/check-supabase-function-exposure.js"
```

Keep the scripts object valid JSON with commas in the right places.

- [ ] **Step 3: Run the checker and confirm it fails before config is complete**

Run:

```bash
npm run check:supabase-functions
```

Expected:

```text
Supabase function exposure check failed:
- calculate-machine-price: missing explicit [functions.calculate-machine-price] config section
...
```

- [ ] **Step 4: Commit**

```bash
git add scripts/check-supabase-function-exposure.js package.json
git commit -m "chore: add supabase function exposure checker"
```

---

### Task 6: Make Function Exposure Explicit in Config

**Files:**
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes:
  - `npm run check:supabase-functions`
- Produces:
  - Explicit `[functions.<name>] verify_jwt = <boolean>` section for each function.

- [ ] **Step 1: Add explicit config sections for local/dev-only functions**

Add these sections:

```toml
[functions.create-admin-user]
verify_jwt = true

[functions.seed-folder-prices]
verify_jwt = true

[functions.seed-generic-prices]
verify_jwt = true

[functions.seed-product-prices]
verify_jwt = true

[functions.setup-schema]
verify_jwt = true

[functions.test-env]
verify_jwt = true
```

- [ ] **Step 2: Add explicit config sections for known public functions**

Keep or add:

```toml
[functions.send-contact-message]
verify_jwt = false

[functions.stripe-subscription-webhook]
verify_jwt = false
```

- [ ] **Step 3: Add explicit config sections for all remaining functions**

For every other directory under `supabase/functions`, add:

```toml
[functions.<function-name>]
verify_jwt = true
```

Use the exact function names from:

```bash
find supabase/functions -mindepth 1 -maxdepth 1 -type d -exec basename {} \\; | sort
```

Do not add a section for `_shared`.

- [ ] **Step 4: Run the exposure checker**

Run:

```bash
npm run check:supabase-functions
```

Expected:

```text
Supabase function exposure check passed for 50 functions.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: make supabase function exposure explicit"
```

---

### Task 7: Update Review Docs and Run Final Verification

**Files:**
- Modify: `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`
- Modify: `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`

**Interfaces:**
- Consumes:
  - Phase 1 implementation results.
- Produces:
  - Updated docs that distinguish completed hardening from remaining work.

- [ ] **Step 1: Update the inventory completed status**

In `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`, add a section:

```md
## Phase 1 Implementation Status

Completed:
- Shared Edge Function HTTP/auth/local-only helpers added.
- Local/dev-only functions guarded with `requireLocalOnly(req)`.
- Function exposure checker added as `npm run check:supabase-functions`.
- Supabase function `verify_jwt` config made explicit.

Remaining:
- Server-side Stripe checkout amount recalculation.
- PDF service ownership, size, and URL restrictions.
- Supplier API key server-side encryption/write path.
- Function-by-function migration to shared auth helpers beyond Phase 1.
```

- [ ] **Step 2: Update the system review**

In `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`, add:

```md
Phase 1 hardening status:
- See `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`.
- Local/dev-only Edge Functions are guarded in code.
- Remaining high-risk work is Stripe server-side amount calculation and PDF-service input ownership.
```

- [ ] **Step 3: Run checks**

Run:

```bash
npm run check:supabase-functions
npm run build
```

Expected:

```text
Supabase function exposure check passed for 50 functions.
✓ built in ...
```

- [ ] **Step 4: Commit**

```bash
git add docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md
git commit -m "docs: update edge function hardening status"
```

---

## Self-Review

Spec coverage:
- Service-role and local/dev-only function risk is covered by Tasks 2, 3, 4, and 6.
- Explicit function exposure is covered by Tasks 5 and 6.
- Admin role verification is covered by Task 3.
- Pricing, POD v1, and POD v2 behavior are intentionally not changed in Phase 1.
- Stripe server-side amount calculation and PDF-service ownership hardening remain separate future phases.

Placeholder scan:
- No task uses forbidden placeholder markers or unspecified validation language as the implementation instruction.
- Each code-changing task includes the relevant code or exact insertion.

Type consistency:
- `jsonResponse`, `optionsResponse`, `requireUser`, `requireRole`, and `requireLocalOnly` are defined before later tasks consume them.
- `requireLocalOnly(req)` is the exact guard string used by the static checker and tasks.
