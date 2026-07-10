#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_STAGED_PACKET_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

const FORBIDDEN_STAGED_PATHS = new Set([
  "supabase/.temp/cli-latest",
  "supabase/config 2.toml",
  "supabase/functions/test-env/index 2.ts",
]);

const CORE_PRICING_SOURCE_PATHS = new Set([
  "src/utils/pricingDatabase.ts",
  "src/utils/productPriceDisplay.ts",
  "src/lib/api/pricingRead.ts",
  "src/lib/api/productDetailRead.ts",
  "src/lib/api/catalogRead.ts",
]);

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial staged packet verifier.

Usage:
  node scripts/check-commercial-staged-packet.mjs
  node scripts/check-commercial-staged-packet.mjs --write-report
  node scripts/check-commercial-staged-packet.mjs --verify-report

Options:
  --write-report   Write a local markdown staged-packet report.
  --verify-report  Verify the local markdown staged-packet report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyStagedPacketReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const stagedPacket = buildStagedPacket(repositoryState);

if (writeReport) {
  await writeStagedPacketReport({ reportPath, repositoryState, stagedPacket });
  if (verifyReport) {
    await verifyStagedPacketReport(reportPath);
  }
} else {
  printSummary(repositoryState, stagedPacket);
}

if (stagedPacket.problems.length) {
  console.error("Commercial staged packet check failed:");
  for (const problem of stagedPacket.problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Commercial staged packet check passed: ${stagedPacket.stagedEntries.length} staged file(s).`);

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
  const [statusResult, stagedResult] = await Promise.all([
    runQuietCommand("git", ["status", "--short", "--branch"]),
    runQuietCommand("git", ["diff", "--cached", "--name-status"]),
  ]);

  const statusLines = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = statusLines.find((line) => line.startsWith("##")) || "unknown";
  const statusEntries = statusLines
    .filter((line) => !line.startsWith("##"))
    .map(parseShortStatusEntry);

  const stagedEntries = stagedResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStagedEntry);

  return {
    available: statusResult.code === 0 && stagedResult.code === 0,
    branchLine,
    statusEntries,
    stagedEntries,
    error: [statusResult.stderr, stagedResult.stderr].filter(Boolean).join("\n").trim(),
  };
}

function parseShortStatusEntry(line) {
  const status = line.slice(0, 2);
  const path = normalizeStatusPath(line.slice(3).trim());
  return {
    line,
    indexStatus: status[0]?.trim() || "",
    worktreeStatus: status[1]?.trim() || "",
    status: status.trim() || "??",
    path,
  };
}

function parseStagedEntry(line) {
  const parts = line.split("\t");
  const status = parts[0] || "";
  const path = normalizeStatusPath(parts.at(-1) || "");
  return {
    line,
    status,
    path,
    bucket: classifyStagedPath(path),
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

function buildStagedPacket(repositoryState) {
  const stagedEntries = repositoryState.stagedEntries;
  const buckets = new Map();
  const problems = [];

  for (const entry of stagedEntries) {
    const current = buckets.get(entry.bucket) || [];
    current.push(entry);
    buckets.set(entry.bucket, current);

    const problem = getStagedProblem(entry.path);
    if (problem) {
      problems.push(problem);
    }
  }

  const heldEntries = repositoryState.statusEntries.filter((entry) => isHeldOutsideStagedPacket(entry.path));
  const forbiddenStagedEntries = stagedEntries.filter((entry) => Boolean(getStagedProblem(entry.path)));
  const stagedPathSet = new Set(stagedEntries.map((entry) => entry.path));
  const stagedWorktreeDriftEntries = repositoryState.statusEntries.filter((entry) => (
    stagedPathSet.has(entry.path)
    && Boolean(entry.worktreeStatus)
    && !isGeneratedCommercialReportPath(entry.path)
  ));
  const stagedSupabaseEntries = stagedEntries.filter((entry) => entry.path.startsWith("supabase/"));
  const deployableSupabaseEntries = stagedSupabaseEntries.filter((entry) => isDeployableSupabaseEntry(entry.path));
  const branchBehind = repositoryState.branchLine.includes("[behind");
  if (stagedWorktreeDriftEntries.length) {
    problems.push(`${stagedWorktreeDriftEntries.length} staged file(s) also have unstaged working-tree changes.`);
  }
  const status = problems.length ? "FAILED" : stagedEntries.length ? "PASS" : "NO STAGED PACKET";

  return {
    status,
    stagedEntries,
    heldEntries,
    forbiddenStagedEntries,
    stagedWorktreeDriftEntries,
    deployableSupabaseEntries,
    buckets,
    branchBehind,
    problems,
  };
}

function classifyStagedPath(path) {
  if (isCommercialProofPath(path)) return "commercial-proof-chain";
  if (isReleaseInfrastructurePath(path)) return "release-infrastructure";
  if (isApplicationSourcePath(path)) return "application-source";
  if (path.startsWith("supabase/") && isDeployableSupabaseEntry(path)) return "supabase-deployable";
  if (path.startsWith("supabase/")) return "supabase-held";
  if (path.startsWith(".agents/") || path.startsWith(".codex/") || path.startsWith(".github/")) return "local-tooling";
  if (
    path === "scripts/supplier-bank-cli.mjs"
    || path.startsWith("config/supplier-bank/")
    || path.startsWith("docs/SUPPLIER_BANK_")
    || path.startsWith("docs/SUPPLIER_PRODUCT_BANK_")
    || path.startsWith("docs/PIXART_")
    || path.startsWith("blueprints/")
  ) return "supplier-bank-evidence";
  if (path.endsWith(".md") || path.startsWith("docs/")) return "documentation";
  return "unclassified";
}

function isCommercialProofPath(path) {
  return (
    path === "src/pages/admin/CommercialReadiness.tsx"
    || path === "package.json"
    || path === "package-lock.json"
    || path === ".gitignore"
    || path === "AI_CONTINUITY.md"
    || path === "HANDOVER.md"
    || path === ".agent/HANDOVER.md"
    || path === "docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md"
    || path === "docs/PRICING_READ_API.md"
    || path === "docs/PRODUCT_DETAIL_READ_API.md"
    || path === "scripts/check-supabase-function-exposure.js"
    || path.startsWith("scripts/check-commercial")
    || path === "scripts/check-tenant-proof-routes.mjs"
    || path.startsWith("docs/COMMERCIAL_")
  );
}

function isReleaseInfrastructurePath(path) {
  return (
    path === ".github/workflows/supabase-data-api-grants.yml"
    || path === ".vercelignore"
    || path === "pnpm-lock.yaml"
  );
}

function isGeneratedCommercialReportPath(path) {
  return path.startsWith("docs/COMMERCIAL_") && path.endsWith(".md");
}

function isApplicationSourcePath(path) {
  if (path === "src/pages/admin/CommercialReadiness.tsx") return false;
  if (path === "scripts/check-supabase-function-exposure.js") return false;
  return path.startsWith("src/") || path === "vite.config.ts";
}

function isDeployableSupabaseEntry(path) {
  if (path.startsWith("supabase/.temp/")) return false;
  if (hasSpaceSuffixedPath(path)) return false;
  if (path === "supabase/config.toml") return true;
  if (path.startsWith("supabase/migrations/")) return true;
  if (path.startsWith("supabase/functions/")) return true;
  return false;
}

function hasSpaceSuffixedPath(path) {
  return /(?:^|\/)[^/]+ \d+\.[^/]+$/.test(path);
}

function isHeldOutsideStagedPacket(path) {
  return (
    FORBIDDEN_STAGED_PATHS.has(path)
    || (path.startsWith("supabase/") && !isDeployableSupabaseEntry(path))
    || path.startsWith(".agents/")
    || path.startsWith(".codex/")
    || path.startsWith(".github/")
    || path === "deno.lock"
  );
}

function getStagedProblem(path) {
  if (FORBIDDEN_STAGED_PATHS.has(path)) {
    return `Forbidden local/debug artifact is staged: ${path}`;
  }
  if (path.startsWith("supabase/") && !isDeployableSupabaseEntry(path)) {
    return `Non-deployable Supabase artifact is staged: ${path}`;
  }
  if (hasSpaceSuffixedPath(path)) {
    return `Space-suffixed duplicate file is staged: ${path}`;
  }
  if (CORE_PRICING_SOURCE_PATHS.has(path)) {
    return `Core pricing source is staged without explicit pricing approval: ${path}`;
  }
  if (path.startsWith("src/lib/pod") || path.startsWith("src/pages/admin/Pod")) {
    return `POD runtime/admin source is staged without POD-specific review: ${path}`;
  }
  const bucket = classifyStagedPath(path);
  if (bucket === "local-tooling" || bucket === "documentation" || bucket === "unclassified" || bucket === "supabase-held") {
    return `Staged path is outside the commercial release packet: ${path}`;
  }
  return "";
}

async function writeStagedPacketReport({ reportPath, repositoryState, stagedPacket }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Staged Packet Report",
    "",
    `Generated: ${generatedAt}`,
    "Git staged command: `git diff --cached --name-status`",
    "Git status command: `git status --short --branch`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${stagedPacket.status}`,
    "",
    "This is a local, read-only staged-packet artifact. It does not stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Review Summary",
    "",
    `Staged entries: ${stagedPacket.stagedEntries.length}`,
    `Forbidden staged files: ${stagedPacket.forbiddenStagedEntries.length}`,
    `Staged file drift: ${stagedPacket.stagedWorktreeDriftEntries.length}`,
    `Deployable Supabase staged entries: ${stagedPacket.deployableSupabaseEntries.length}`,
    `Held outside staged packet: ${stagedPacket.heldEntries.length}`,
    `Branch behind remote: ${stagedPacket.branchBehind ? "yes" : "no"}`,
    "",
    "## Staged Bucket Counts",
    "",
    "| Bucket | Entries | Review meaning |",
    "| --- | ---: | --- |",
    ...bucketRows(stagedPacket),
    "",
    "## Guardrail Checks",
    "",
    "| Status | Guardrail | Evidence |",
    "| --- | --- | --- |",
    `| ${stagedPacket.forbiddenStagedEntries.length ? "FAIL" : "PASS"} | Forbidden staged files | ${stagedPacket.forbiddenStagedEntries.length ? "One or more forbidden local/debug artifacts are staged." : "Forbidden staged files: 0."} |`,
    `| ${stagedPacket.stagedWorktreeDriftEntries.length ? "FAIL" : "PASS"} | Staged file drift | ${stagedPacket.stagedWorktreeDriftEntries.length ? "One or more staged files also have unstaged working-tree changes." : "Staged file drift: 0."} |`,
    `| ${stagedPacket.stagedEntries.some((entry) => CORE_PRICING_SOURCE_PATHS.has(entry.path)) ? "FAIL" : "PASS"} | Core pricing source | Core pricing/POD guardrails checked against staged paths. |`,
    `| ${stagedPacket.stagedEntries.some((entry) => entry.path.startsWith("src/lib/pod") || entry.path.startsWith("src/pages/admin/Pod")) ? "FAIL" : "PASS"} | POD source | POD runtime/admin paths are not staged in this packet. |`,
    `| ${stagedPacket.heldEntries.length ? "PASS" : "PASS"} | Supabase held outside staged packet | ${stagedPacket.heldEntries.length ? "Local/temp Supabase artifacts remain visible outside the staged deployable packet." : "No known Supabase local/temp artifacts are visible."} |`,
    "",
    "## Staged Files",
    "",
    "| Status | Bucket | Path |",
    "| --- | --- | --- |",
    ...stagedPacket.stagedEntries.map((entry) => `| ${escapeMarkdownTable(entry.status)} | ${escapeMarkdownTable(entry.bucket)} | \`${escapeMarkdownTable(entry.path)}\` |`),
    stagedPacket.stagedEntries.length ? "" : "| none | none | `No staged files` |",
    "",
    "## Held Outside Staged Packet",
    "",
    "| Status | Path | Reason |",
    "| --- | --- | --- |",
    ...heldRows(stagedPacket),
    "",
    "## Required Verification",
    "",
    "- `npm run check:commercial-staged-packet` must pass before a push/deploy decision uses the staged packet.",
    "- `git diff --cached --check` must pass before commit.",
    "- `npm run check:commercial-release` must pass after report regeneration.",
    "- Held files such as `supabase/.temp/cli-latest`, `supabase/config 2.toml` and `supabase/functions/test-env/index 2.ts` must stay outside the staged packet unless explicitly approved.",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial staged packet report: ${reportPath}`);
}

async function verifyStagedPacketReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Staged Packet Report",
    "This is a local, read-only staged-packet artifact.",
    "Git staged command: `git diff --cached --name-status`",
    "Staged entries:",
    "Forbidden staged files:",
    "Staged file drift:",
    "Deployable Supabase staged entries:",
    "Held outside staged packet:",
    "Staged Bucket Counts",
    "Guardrail Checks",
    "Forbidden staged files: 0",
    "Staged file drift: 0",
    "Core pricing/POD guardrails",
    "Supabase held outside staged packet",
    "## Staged Files",
    "## Held Outside Staged Packet",
    "## Required Verification",
    "npm run check:commercial-staged-packet",
    "git diff --cached --check",
    "npm run check:commercial-release",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing staged packet report marker: ${marker}`);
    }
  }

  if (content.includes("| FAIL |")) {
    problems.push("Staged packet report contains a failing guardrail row.");
  }

  const stagedEntriesLine = content.split("\n").find((line) => line.startsWith("Staged entries: "));
  const stagedEntries = Number.parseInt(stagedEntriesLine?.slice("Staged entries: ".length).trim() || "", 10);
  if (!Number.isInteger(stagedEntries) || stagedEntries < 0) {
    problems.push("Staged packet report is missing a valid staged entry count.");
  }

  const forbiddenLine = content.split("\n").find((line) => line.startsWith("Forbidden staged files: "));
  const forbiddenFiles = Number.parseInt(forbiddenLine?.slice("Forbidden staged files: ".length).trim() || "", 10);
  if (forbiddenFiles !== 0) {
    problems.push(`Expected Forbidden staged files: 0, found ${Number.isNaN(forbiddenFiles) ? "missing" : forbiddenFiles}.`);
  }

  const driftLine = content.split("\n").find((line) => line.startsWith("Staged file drift: "));
  const stagedFileDrift = Number.parseInt(driftLine?.slice("Staged file drift: ".length).trim() || "", 10);
  if (stagedFileDrift !== 0) {
    problems.push(`Expected Staged file drift: 0, found ${Number.isNaN(stagedFileDrift) ? "missing" : stagedFileDrift}.`);
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Staged packet report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial staged packet report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial staged packet report check passed: ${path}`);
}

function bucketRows(stagedPacket) {
  if (!stagedPacket.buckets.size) {
    return ["| none | 0 | No staged files are currently present. |"];
  }
  return [...stagedPacket.buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, entries]) => `| ${escapeMarkdownTable(bucket)} | ${entries.length} | ${escapeMarkdownTable(bucketMeaning(bucket))} |`);
}

function bucketMeaning(bucket) {
  if (bucket === "commercial-proof-chain") return "Cockpit, proof scripts, generated commercial reports or package wiring.";
  if (bucket === "application-source") return "Runtime source changes that need build and tenant browser proof.";
  if (bucket === "release-infrastructure") return "Reviewed release, deploy or CI infrastructure used by the current packet.";
  if (bucket === "supabase-deployable") return "Deploy-review migrations or Edge Functions with grant/function checks.";
  if (bucket === "supabase-held") return "Supabase local/temp/debug artifacts that must not be staged.";
  if (bucket === "local-tooling") return "Local agent/tooling state that should stay outside a release packet.";
  if (bucket === "supplier-bank-evidence") return "Reviewed Supplier Bank runbooks, reports, candidate blueprints or tooling for the current platform goal.";
  if (bucket === "documentation") return "Documentation outside the commercial proof chain.";
  return "Needs manual classification before release.";
}

function heldRows(stagedPacket) {
  if (!stagedPacket.heldEntries.length) {
    return ["| none | `none` | No known hold files visible. |"];
  }
  return stagedPacket.heldEntries.map((entry) => `| ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownTable(entry.path)}\` | ${escapeMarkdownTable(holdReason(entry.path))} |`);
}

function holdReason(path) {
  if (path.startsWith("supabase/.temp/")) return "Local Supabase CLI state.";
  if (path === "supabase/config 2.toml") return "Space-suffixed duplicate config.";
  if (path === "supabase/functions/test-env/index 2.ts") return "Space-suffixed test/debug Edge Function file.";
  if (path.startsWith(".agents/") || path.startsWith(".codex/") || path.startsWith(".github/")) return "Local tooling or repository automation outside this release packet.";
  if (path === "deno.lock") return "Local dependency lock change outside the reviewed packet.";
  return "Held because it is not part of the commercial staged packet.";
}

function printSummary(repositoryState, stagedPacket) {
  if (!repositoryState.available) {
    console.warn(repositoryState.error || "Repository state unavailable.");
  }
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${stagedPacket.status}`);
  console.log(`Staged entries: ${stagedPacket.stagedEntries.length}`);
  console.log(`Forbidden staged files: ${stagedPacket.forbiddenStagedEntries.length}`);
  console.log(`Staged file drift: ${stagedPacket.stagedWorktreeDriftEntries.length}`);
  console.log(`Held outside staged packet: ${stagedPacket.heldEntries.length}`);
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
