#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = "supabase/migrations";
const args = new Set(process.argv.slice(2));
const checkAll = args.has("--all");

const identifier = String.raw`(?:"[^"]+"|[a-zA-Z_][\w$]*)`;
const tableCreateRe = new RegExp(
  String.raw`\bcreate\s+(?:unlogged\s+|temporary\s+|temp\s+)?table\s+(?:if\s+not\s+exists\s+)?((?:${identifier}\s*\.\s*)?${identifier})`,
  "gi",
);
const viewCreateRe = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?((?:${identifier}\s*\.\s*)?${identifier})`,
  "gi",
);
const functionCreateRe = new RegExp(
  String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+((?:${identifier}\s*\.\s*)?${identifier})\s*\(`,
  "gi",
);

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n\r]*/g, " ");
}

function walkSqlFiles(dir) {
  const absolute = path.join(root, dir);
  if (!existsSync(absolute)) return [];

  return readdirSync(absolute)
    .flatMap((entry) => {
      const full = path.join(absolute, entry);
      const relative = path.relative(root, full);
      if (statSync(full).isDirectory()) return walkSqlFiles(relative);
      return relative.endsWith(".sql") ? [relative] : [];
    })
    .sort();
}

function candidateFiles() {
  if (checkAll) return walkSqlFiles(migrationsDir);

  const diffRange = process.env.SUPABASE_GRANTS_DIFF_BASE
    ? [`${process.env.SUPABASE_GRANTS_DIFF_BASE}...HEAD`]
    : process.env.GITHUB_BASE_REF
      ? [`origin/${process.env.GITHUB_BASE_REF}...HEAD`]
      : process.env.GITHUB_EVENT_BEFORE &&
          !/^0+$/.test(process.env.GITHUB_EVENT_BEFORE)
        ? [`${process.env.GITHUB_EVENT_BEFORE}...HEAD`]
        : [];

  const changed =
    diffRange.length > 0
      ? runGit([
          "diff",
          "--name-only",
          "--diff-filter=ACMRTUXB",
          ...diffRange,
          "--",
          migrationsDir,
        ])
      : runGit([
          "diff",
          "--name-only",
          "--diff-filter=ACMRTUXB",
          "HEAD",
          "--",
          migrationsDir,
        ]);
  const untracked =
    diffRange.length > 0
      ? []
      : runGit([
          "ls-files",
          "--others",
          "--exclude-standard",
          "--",
          migrationsDir,
        ]);

  return [...new Set([...changed, ...untracked])]
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function normalizeQualifiedName(rawName) {
  const parts = rawName
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);

  if (parts.length === 1) {
    return { schema: "public", name: parts[0], display: `public.${parts[0]}` };
  }

  return {
    schema: parts.at(-2),
    name: parts.at(-1),
    display: `${parts.at(-2)}.${parts.at(-1)}`,
  };
}

function collectPublicObjects(sql, regex, kind) {
  const objects = [];
  for (const match of sql.matchAll(regex)) {
    const object = normalizeQualifiedName(match[1]);
    if (object.schema === "public") {
      objects.push({ ...object, kind });
    }
  }
  return objects;
}

function escapedName(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasAccessDecision(rawSql, sql, object) {
  const name = escapedName(object.name);
  const qualified = String.raw`(?:public\s*\.\s*)?"?${name}"?`;
  const privateMarker = new RegExp(
    String.raw`--\s*data-api:\s*(?:private|internal)\b[^\n]*\b${name}\b`,
    "i",
  );

  if (privateMarker.test(rawSql)) return true;

  if (object.kind === "function") {
    const grantExecute = new RegExp(
      String.raw`\bgrant\s+execute\s+on\s+function\s+${qualified}\s*\(`,
      "i",
    );
    const revokeExecute = new RegExp(
      String.raw`\brevoke\s+execute\s+on\s+function\s+${qualified}\s*\(`,
      "i",
    );
    return grantExecute.test(sql) || revokeExecute.test(sql);
  }

  const grant = new RegExp(
    String.raw`\bgrant\s+[\s\S]*?\bon\s+(?:table\s+|view\s+|materialized\s+view\s+)?${qualified}\b`,
    "i",
  );
  const revoke = new RegExp(
    String.raw`\brevoke\s+[\s\S]*?\bon\s+(?:table\s+|view\s+|materialized\s+view\s+)?${qualified}\b`,
    "i",
  );

  return grant.test(sql) || revoke.test(sql);
}

const files = candidateFiles();
const failures = [];

for (const file of files) {
  const rawSql = readFileSync(path.join(root, file), "utf8");
  const sql = stripSqlComments(rawSql);
  const objects = [
    ...collectPublicObjects(sql, tableCreateRe, "table"),
    ...collectPublicObjects(sql, viewCreateRe, "view"),
    ...collectPublicObjects(sql, functionCreateRe, "function"),
  ];

  for (const object of objects) {
    if (!hasAccessDecision(rawSql, sql, object)) {
      failures.push({ file, object });
    }
  }
}

if (failures.length > 0) {
  console.error("Supabase Data API grant check failed.");
  console.error(
    "Every new public table/view/function migration needs an explicit GRANT/REVOKE decision, or a '-- data-api: private <name>' marker.",
  );
  console.error("");

  for (const { file, object } of failures) {
    console.error(`- ${file}: ${object.kind} ${object.display}`);
  }

  console.error("");
  console.error("Examples:");
  console.error("  grant select on public.my_table to anon;");
  console.error("  grant select, insert, update, delete on public.my_table to authenticated;");
  console.error("  grant all on public.my_table to service_role;");
  console.error("  revoke all on table public.internal_table from anon, authenticated;");
  console.error("  -- data-api: private internal_table");
  process.exit(1);
}

console.log(
  files.length === 0
    ? "No changed Supabase migration SQL files to check."
    : `Supabase Data API grant check passed for ${files.length} migration file(s).`,
);
