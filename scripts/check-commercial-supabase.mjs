#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_SUPABASE_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial Supabase review report.

Usage:
  node scripts/check-commercial-supabase.mjs
  node scripts/check-commercial-supabase.mjs --write-report
  node scripts/check-commercial-supabase.mjs --verify-report

Options:
  --write-report   Write a local markdown Supabase review report.
  --verify-report  Verify the local markdown Supabase report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifySupabaseReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const review = await buildSupabaseReview(repositoryState);

if (writeReport) {
  await writeSupabaseReport({ reportPath, repositoryState, review });
  if (verifyReport) {
    await verifySupabaseReport(reportPath);
  }
} else {
  printSummary(repositoryState, review);
}

function hasFlag(name) {
  return args.includes(name);
}

function readArg(name, fallback) {
  const eqArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (eqArg) return eqArg.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

async function readRepositoryState() {
  const result = await runQuietCommand("git", ["status", "--short", "--branch"]);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || "git status unavailable").trim();
    return {
      available: false,
      branchLine: "unavailable",
      entries: [],
      error: detail,
    };
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("##")) || "unknown";
  const entries = lines
    .filter((line) => !line.startsWith("##"))
    .map(parseStatusEntry);

  return {
    available: true,
    branchLine,
    entries,
    error: "",
  };
}

function parseStatusEntry(line) {
  const status = line.slice(0, 2).trim() || "??";
  const rawPath = normalizeStatusPath(line.slice(3).trim());
  return {
    line,
    status,
    path: rawPath,
  };
}

function normalizeStatusPath(path) {
  const trimmed = String(path || "").trim();
  const renamedPath = trimmed.includes(" -> ") ? trimmed.split(" -> ").at(-1).trim() : trimmed;
  if (renamedPath.startsWith('"') && renamedPath.endsWith('"')) {
    return renamedPath
      .slice(1, -1)
      .replaceAll('\\"', '"')
      .replaceAll("\\\\", "\\");
  }
  return renamedPath;
}

async function buildSupabaseReview(repositoryState) {
  const entries = repositoryState.entries.filter((entry) => entry.path.startsWith("supabase/"));
  const grantsCheck = await runCheck("Supabase Data API grants", [
    "scripts/check-supabase-migration-grants.js",
  ]);
  const functionsCheck = await runCheck("Supabase function exposure", [
    "scripts/check-supabase-function-exposure.js",
  ]);
  const groups = new Map();

  for (const entry of entries) {
    const group = supabaseRiskGroup(entry.path);
    const current = groups.get(group.label) || { ...group, entries: [] };
    current.entries.push(entry);
    groups.set(group.label, current);
  }

  const checks = [grantsCheck, functionsCheck];

  return {
    status: checks.every((check) => check.ok) ? (entries.length ? "REVIEW REQUIRED" : "CLEAN") : "FAILED",
    entries,
    deployableEntries: entries.filter((entry) => isDeployableSupabaseEntry(entry.path)),
    holdEntries: entries.filter((entry) => !isDeployableSupabaseEntry(entry.path)),
    groups,
    checks,
  };
}

function hasSpaceSuffixedPath(path) {
  return /(?:^|\/)[^/]+ \d+\.[^/]+$/.test(path);
}

function isDeployableSupabaseEntry(path) {
  if (path.startsWith("supabase/.temp/")) return false;
  if (path.includes("config") && hasSpaceSuffixedPath(path)) return false;
  if (hasSpaceSuffixedPath(path)) return false;
  if (path === "supabase/config.toml") return true;
  if (path.startsWith("supabase/migrations/")) return true;
  if (path.startsWith("supabase/functions/")) return true;
  return false;
}

function supabaseDecision(path) {
  return isDeployableSupabaseEntry(path) ? "DEPLOY-REVIEW" : "HOLD";
}

function supabaseRiskGroup(path) {
  if (path.startsWith("supabase/migrations/")) {
    return {
      label: "migration/grants",
      focus: "Verify explicit Data API GRANT/REVOKE decisions, RLS scope and rollback notes before deployment.",
    };
  }

  if (path.startsWith("supabase/functions/")) {
    return {
      label: "edge functions",
      focus: "Verify auth/JWT exposure, service-role use, tenant scoping and production deployment intent.",
    };
  }

  if (path === "supabase/config.toml") {
    return {
      label: "function deployment config",
      focus: "Verify function JWT/public-read settings before deploying Edge Functions.",
    };
  }

  if (path.startsWith("supabase/.temp/")) {
    return {
      label: "local Supabase temp",
      focus: "Usually local tooling state; avoid staging unless there is a deliberate reason.",
    };
  }

  if (path.includes("config")) {
    return {
      label: "config duplicate/local",
      focus: "Confirm duplicate or space-suffixed config files are local artifacts and not deployable config.",
    };
  }

  return {
    label: "supabase shared",
    focus: "Review as database/function tooling before deploy.",
  };
}

function runCheck(label, commandArgs) {
  return runQuietCommand(process.execPath, commandArgs).then((result) => ({
    label,
    ok: result.code === 0,
    output: (result.stdout || result.stderr || "").trim(),
  }));
}

async function writeSupabaseReport({ reportPath, repositoryState, review }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Supabase Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${review.status}`,
    "",
    "This is a local, read-only Supabase review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Review Summary",
    "",
    `Supabase entries: ${review.entries.length}`,
    `Deployable packet entries: ${review.deployableEntries.length}`,
    `Hold/local artifact entries: ${review.holdEntries.length}`,
    `Risk groups: ${review.groups.size}`,
    "",
    "## Required Checks",
    "",
    "| Status | Check | Evidence |",
    "| --- | --- | --- |",
    ...review.checks.map((check) => `| ${check.ok ? "PASS" : "FAIL"} | ${escapeMarkdownTable(check.label)} | ${escapeMarkdownTable(check.output || "No output")} |`),
    "",
    "## Supabase Risk Groups",
    "",
    "| Group | Files | Review focus |",
    "| --- | ---: | --- |",
    ...supabaseRiskGroupRows(review),
    "",
    "## Required Verification",
    "",
    "- `npm run check:supabase-grants` must pass for changed/untracked migrations.",
    "- `npm run check:supabase-functions` must pass before any function deploy.",
    "- Function changes touching `pricing-read` or `product-detail-read` need service-role, tenant-scope and public exposure review before deployment.",
    "- Space-suffixed Supabase files such as `supabase/config 2.toml` or `supabase/functions/test-env/index 2.ts` are held outside the deployable packet unless explicitly approved.",
    "",
    "## Supabase Candidate Files",
    "",
    "| Decision | Status | Path | Risk group | Review focus |",
    "| --- | --- | --- | --- | --- |",
    ...supabaseCandidateRows(review),
    "",
    "## Held Outside Deployable Packet",
    "",
    "| Status | Path | Hold reason |",
    "| --- | --- | --- |",
    ...supabaseHoldRows(review),
    "",
    "## Deploy Owner Plan",
    "",
    ...deployOwnerPlanLines(review),
    "",
    "## Rollback Notes",
    "",
    ...rollbackNoteLines(review),
    "",
    "## Post-Deploy Smoke",
    "",
    ...postDeploySmokeLines(review),
    "",
    "## Suggested Packet Commands",
    "",
    "```sh",
    formatGitCommand("git add --", review.deployableEntries.map((entry) => entry.path)),
    "```",
    "",
    "```sh",
    "npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial Supabase report: ${reportPath}`);
}

function supabaseRiskGroupRows(review) {
  if (!review.groups.size) {
    return ["| none | 0 | No Supabase files are currently dirty. |"];
  }

  return [...review.groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => `| ${escapeMarkdownTable(group.label)} | ${group.entries.length} | ${escapeMarkdownTable(group.focus)} |`);
}

function supabaseCandidateRows(review) {
  if (!review.entries.length) {
    return ["| REVIEW | clean | none | none | No Supabase entries are currently dirty. |"];
  }

  return review.entries.map((entry) => {
    const group = supabaseRiskGroup(entry.path);
    return `| ${supabaseDecision(entry.path)} | ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(group.label)} | ${escapeMarkdownTable(group.focus)} |`;
  });
}

function supabaseHoldRows(review) {
  if (!review.holdEntries.length) {
    return ["| clean | none | No local Supabase artifacts are currently held. |"];
  }

  return review.holdEntries.map((entry) => {
    const group = supabaseRiskGroup(entry.path);
    return `| HOLD | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(group.focus)} |`;
  });
}

async function verifySupabaseReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Supabase Report",
    "Status:",
    "This is a local, read-only Supabase review artifact.",
    "It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "## Review Summary",
    "Supabase entries:",
    "Deployable packet entries:",
    "Hold/local artifact entries:",
    "Risk groups:",
    "## Required Checks",
    "Supabase Data API grants",
    "Supabase function exposure",
    "## Supabase Risk Groups",
    "## Required Verification",
    "npm run check:supabase-grants",
    "npm run check:supabase-functions",
    "pricing-read",
    "product-detail-read",
    "## Supabase Candidate Files",
    "## Held Outside Deployable Packet",
    "## Deploy Owner Plan",
    "## Rollback Notes",
    "## Post-Deploy Smoke",
    "## Suggested Packet Commands",
    "git add --",
    "check:commercial-supabase:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing Supabase report marker: ${marker}`);
    }
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Supabase report is missing a parseable Generated timestamp.");
  }

  const supabaseEntriesLine = content.split("\n").find((line) => line.startsWith("Supabase entries: "));
  const supabaseEntries = Number.parseInt(supabaseEntriesLine?.slice("Supabase entries: ".length).trim() || "", 10);
  if (!Number.isInteger(supabaseEntries) || supabaseEntries < 0) {
    problems.push("Supabase report is missing a valid Supabase entries count.");
  }

  if (content.includes("| FAIL |")) {
    problems.push("Supabase report contains a failing check row.");
  }

  if (problems.length) {
    console.error(`Commercial Supabase report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial Supabase report check passed: ${path}`);
}

function deployOwnerPlanLines(review) {
  if (!review.deployableEntries.length) {
    return ["- No Supabase deployable files are in this packet."];
  }

  const lines = [
    "- Deploy only after the release owner has freshened the branch and rerun `npm run check:commercial-release`.",
    "- Apply the index migration before deploying the public read functions when this packet is released.",
  ];

  if (review.deployableEntries.some((entry) => entry.path === "supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql")) {
    lines.push("- Migration: `supabase db push` or the project-approved migration deploy path for `20260509120000_index_generic_product_prices_lookup.sql`.");
  }

  if (review.deployableEntries.some((entry) => entry.path === "supabase/config.toml")) {
    lines.push("- Config: `pricing-read` and `product-detail-read` are intentionally public read functions (`verify_jwt = false`) and must stay tenant-scoped in code.");
  }

  const functionNames = review.deployableEntries
    .map((entry) => functionNameFromPath(entry.path))
    .filter(Boolean);
  if (functionNames.length) {
    lines.push(`- Functions: deploy ${functionNames.map((name) => `\`${name}\``).join(", ")} with the project-approved Supabase function deploy command.`);
  }

  return lines;
}

function rollbackNoteLines(review) {
  const lines = [];

  if (review.deployableEntries.some((entry) => entry.path === "supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql")) {
    lines.push("- Index rollback SQL: `DROP INDEX IF EXISTS public.idx_generic_product_prices_product_quantity_id;`");
  }

  if (review.deployableEntries.some((entry) => entry.path === "supabase/config.toml")) {
    lines.push("- Function exposure rollback: restore `verify_jwt = true` for `pricing-read` and `product-detail-read`, then redeploy function config.");
  }

  const functionNames = review.deployableEntries
    .map((entry) => functionNameFromPath(entry.path))
    .filter(Boolean);
  if (functionNames.length) {
    lines.push(`- Function rollback: redeploy the previous known-good versions of ${functionNames.map((name) => `\`${name}\``).join(", ")}.`);
  }

  return lines.length ? lines : ["- No Supabase rollback notes are required for this packet."];
}

function postDeploySmokeLines(review) {
  if (!review.deployableEntries.length) {
    return ["- No Supabase post-deploy smoke required for this packet."];
  }

  return [
    "- Run `npm run check:commercial-release` after Supabase deployment.",
    "- Check Webprinter Aluminium price/order handoff.",
    "- Check Salgsmapper standard folder template/download/designer handoff.",
    "- Check Onlinetryksager flyer order handoff.",
    "- Stop and roll back if either public read function returns cross-tenant data, unpublished products, missing prices, or CORS/JWT errors.",
  ];
}

function functionNameFromPath(path) {
  const match = path.match(/^supabase\/functions\/([^/]+)\/index\.ts$/);
  return match?.[1] || "";
}

function printSummary(repositoryState, review) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${review.status}`);
  console.log(`Supabase entries: ${review.entries.length}`);
  for (const check of review.checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}: ${check.output}`);
  }
}

function runQuietCommand(command, commandArgs) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        code: 1,
        stdout,
        stderr: error instanceof Error ? error.message : String(error),
      });
    });

    child.on("exit", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

function escapeMarkdownTable(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMarkdownCode(value) {
  return String(value || "").replaceAll("`", "\\`").trim();
}

function formatGitCommand(prefix, paths) {
  if (!paths.length) return `${prefix} # no files`;
  return [
    prefix,
    ...paths.map((path) => quoteShellPath(path)),
  ].join(" \\\n  ");
}

function quoteShellPath(path) {
  return `'${String(path).replaceAll("'", "'\\''")}'`;
}
