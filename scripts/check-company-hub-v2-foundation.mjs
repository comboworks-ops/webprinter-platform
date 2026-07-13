import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260713090000_company_hub_v2_foundation.sql",
);

const requiredTables = [
  "company_offices",
  "company_addresses",
  "company_member_offices",
  "company_catalog_categories",
  "company_catalog_item_offices",
  "company_template_bindings",
  "company_template_fields",
  "company_assets",
  "company_order_requests",
  "company_consultant_requests",
  "company_activity_events",
];

const requiredFunctions = [
  "company_hub_has_role",
  "company_hub_is_member",
  "company_hub_can_access_office",
];

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

async function main() {
  const migration = await readFile(migrationPath, "utf8");

  for (const table of requiredTables) {
    assertMatch(
      migration,
      new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\b`, "i"),
      `Migration mangler tabel: ${table}`,
    );
    assertMatch(
      migration,
      new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `RLS er ikke aktiveret for: ${table}`,
    );
    assertMatch(
      migration,
      new RegExp(`revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+anon`, "i"),
      `Anon-adgang er ikke eksplicit fjernet for: ${table}`,
    );
    assertMatch(
      migration,
      new RegExp(`grant\\s+[\\s\\S]{0,120}on\\s+table\\s+public\\.${table}\\s+to\\s+authenticated`, "i"),
      `Authenticated grant mangler for: ${table}`,
    );
    assertMatch(
      migration,
      new RegExp(`grant\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+service_role`, "i"),
      `Service-role grant mangler for: ${table}`,
    );
  }

  for (const functionName of requiredFunctions) {
    assertMatch(
      migration,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`, "i"),
      `RLS-hjælpefunktion mangler: ${functionName}`,
    );
    assertMatch(
      migration,
      new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([^;]+from\\s+public`, "i"),
      `Public execute er ikke fjernet for: ${functionName}`,
    );
    assertMatch(
      migration,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\s*\\([^;]+to\\s+authenticated`, "i"),
      `Authenticated execute mangler for: ${functionName}`,
    );
  }

  assertMatch(
    migration,
    /rollback note:/i,
    "Migrationen mangler en eksplicit rollback note",
  );
  assertMatch(
    migration,
    /alter\s+table\s+public\.company_accounts[\s\S]+add\s+column\s+if\s+not\s+exists\s+status/i,
    "company_accounts mangler V2-status",
  );
  assertMatch(
    migration,
    /alter\s+table\s+public\.company_hub_items[\s\S]+add\s+column\s+if\s+not\s+exists\s+template_binding_id/i,
    "company_hub_items mangler template_binding_id",
  );

  console.log(
    `Company Hub V2 foundation OK: ${requiredTables.length} tabeller og ${requiredFunctions.length} RLS-hjælpere verificeret.`,
  );
}

main().catch((error) => {
  console.error(`Company Hub V2 foundation check fejlede: ${error.message}`);
  process.exitCode = 1;
});
