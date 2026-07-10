#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md";
const RELEASE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_LATEST.md";
const STAGED_PACKET_REPORT_PATH = "docs/COMMERCIAL_STAGED_PACKET_LATEST.md";
const BRANCH_FRESHNESS_REPORT_PATH = "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md";
const UPSTREAM_RECONCILIATION_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const OWNER_MERGE_READINESS_REPORT_PATH = "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md";
const RELEASE_OWNER_SEQUENCE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");
const strict = hasFlag("--strict");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial deploy readiness report.

Usage:
  node scripts/check-commercial-deploy-readiness.mjs
  node scripts/check-commercial-deploy-readiness.mjs --write-report
  node scripts/check-commercial-deploy-readiness.mjs --verify-report
  node scripts/check-commercial-deploy-readiness.mjs --strict

Options:
  --write-report   Write a local markdown deploy-readiness report.
  --verify-report  Verify the local markdown deploy-readiness report structure.
  --strict         Exit non-zero when readiness is HOLD or BLOCKED.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyDeployReadinessReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const checks = await buildDeployReadinessChecks(repositoryState);
const status = getReadinessStatus(checks);

if (writeReport) {
  await writeDeployReadinessReport({ reportPath, repositoryState, checks, status });
  if (verifyReport) {
    await verifyDeployReadinessReport(reportPath);
  }
} else {
  printSummary(repositoryState, checks, status);
}

if (strict && status !== "READY") {
  console.error(`Commercial deploy readiness is ${status}. Use the report for blockers before push/deploy.`);
  process.exit(1);
}

console.log(`Commercial deploy readiness report check completed: ${status}.`);

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
  const [statusResult, stagedResult, diffCheckResult] = await Promise.all([
    runQuietCommand("git", ["status", "--short", "--branch"]),
    runQuietCommand("git", ["diff", "--cached", "--name-status"]),
    runQuietCommand("git", ["diff", "--cached", "--check"]),
  ]);

  const statusLines = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = statusLines.find((line) => line.startsWith("##")) || "unknown";
  const entries = statusLines
    .filter((line) => !line.startsWith("##"))
    .map(parseStatusEntry);
  const stagedEntries = stagedResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStagedEntry);

  return {
    available: statusResult.code === 0 && stagedResult.code === 0,
    branchLine,
    branchBehind: branchLine.includes("[behind"),
    branchAhead: branchLine.includes("[ahead"),
    entries,
    stagedEntries,
    stagedDiffCheckOk: diffCheckResult.code === 0,
    stagedDiffCheckOutput: (diffCheckResult.stdout || diffCheckResult.stderr || "").trim(),
    error: [statusResult.stderr, stagedResult.stderr].filter(Boolean).join("\n").trim(),
  };
}

function parseStatusEntry(line) {
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
  return {
    line,
    status: parts[0] || "",
    path: normalizeStatusPath(parts.at(-1) || ""),
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

async function buildDeployReadinessChecks(repositoryState) {
  const [
    releaseReport,
    stagedPacketReport,
    branchFreshnessReport,
    upstreamReconciliationReport,
    ownerMergeReadinessReport,
    releaseOwnerSequenceReport,
  ] = await Promise.all([
    readReport(RELEASE_REPORT_PATH),
    readReport(STAGED_PACKET_REPORT_PATH),
    readReport(BRANCH_FRESHNESS_REPORT_PATH),
    readReport(UPSTREAM_RECONCILIATION_REPORT_PATH),
    readReport(OWNER_MERGE_READINESS_REPORT_PATH),
    readReport(RELEASE_OWNER_SEQUENCE_REPORT_PATH),
  ]);
  const stagedForbiddenCount = readNumberLine(stagedPacketReport.content, "Forbidden staged files: ");
  const heldCount = readNumberLine(stagedPacketReport.content, "Held outside staged packet: ");
  const branchFreshnessStatus = readLine(branchFreshnessReport.content, "Status: ");
  const branchOverlapCount = readNumberLine(branchFreshnessReport.content, "Overlaps with staged packet: ");
  const upstreamReconciliationStatus = readLine(upstreamReconciliationReport.content, "Status: ");
  const unresolvedOverlapCount = readNumberLine(upstreamReconciliationReport.content, "Unresolved overlaps: ");
  const ownerMergeReadinessStatus = readLine(ownerMergeReadinessReport.content, "Status: ");
  const ownerMergeSimulationPassed = ownerMergeReadinessReport.content.includes("Merge simulation: PASS")
    && !ownerMergeReadinessReport.content.includes("| BLOCKED |");
  const releaseOwnerSequenceStatus = readLine(releaseOwnerSequenceReport.content, "Status: ");
  const releaseOwnerSequenceUsable = releaseOwnerSequenceReport.content.includes("Owner merge simulation: PASS")
    && releaseOwnerSequenceReport.content.includes("Freshen the branch while preserving the staged packet.")
    && !releaseOwnerSequenceReport.content.includes("| BLOCKED |")
    && !releaseOwnerSequenceReport.content.includes("- BLOCKED:");
  const releasePassed = releaseReport.content.includes("Status: PASSED")
    && releaseReport.content.includes("Commercial staged packet report generated and verified.")
    && releaseReport.content.includes("Vite production build passed.");
  const stagedPacketPassed = stagedPacketReport.content.includes("Status: PASS")
    && stagedPacketReport.content.includes("Forbidden staged files: 0");
  const unstagedEntries = repositoryState.entries.filter((entry) => entry.worktreeStatus || entry.status === "??");
  const releaseImpactingUnstaged = unstagedEntries.filter((entry) => isReleaseImpactingOutsidePath(entry.path));
  const highRiskHeld = repositoryState.entries.filter((entry) => isHighRiskHeldPath(entry.path));

  return [
    {
      label: "Release proof",
      status: releaseReport.exists && releasePassed ? "PASS" : "BLOCKED",
      evidence: releaseReport.exists
        ? "Latest commercial release report is present and shows Status: PASSED."
        : `Missing ${RELEASE_REPORT_PATH}.`,
      next: releaseReport.exists && releasePassed ? "Keep report with the packet." : "Run npm run check:commercial-release.",
    },
    {
      label: "Staged packet safety",
      status: stagedPacketReport.exists && stagedPacketPassed && stagedForbiddenCount === 0 ? "PASS" : "BLOCKED",
      evidence: stagedPacketReport.exists
        ? `Staged report shows ${Number.isFinite(stagedForbiddenCount) ? stagedForbiddenCount : "unknown"} forbidden staged files.`
        : `Missing ${STAGED_PACKET_REPORT_PATH}.`,
      next: stagedPacketReport.exists && stagedPacketPassed && stagedForbiddenCount === 0
        ? "Keep held artifacts outside the staged packet."
        : "Run npm run check:commercial-staged-packet:write and remove forbidden staged files.",
    },
    {
      label: "Staged diff hygiene",
      status: repositoryState.stagedDiffCheckOk ? "PASS" : "BLOCKED",
      evidence: repositoryState.stagedDiffCheckOk
        ? "git diff --cached --check passed."
        : repositoryState.stagedDiffCheckOutput || "git diff --cached --check failed.",
      next: repositoryState.stagedDiffCheckOk ? "No whitespace/path cleanup needed in staged packet." : "Fix staged whitespace/path errors before commit.",
    },
    {
      label: "Branch freshness report",
      status: !branchFreshnessReport.exists
        ? "BLOCKED"
        : branchFreshnessStatus === "READY"
          ? "PASS"
          : "HOLD",
      evidence: branchFreshnessReport.exists
        ? `Branch report shows Status: ${branchFreshnessStatus || "unknown"}; overlaps with staged packet: ${Number.isFinite(branchOverlapCount) ? branchOverlapCount : "unknown"}.`
        : `Missing ${BRANCH_FRESHNESS_REPORT_PATH}.`,
      next: branchFreshnessReport.exists && branchFreshnessStatus === "READY"
        ? "No upstream-only overlap is visible from the branch report."
        : "Review the upstream-only commit and any overlap before commit/push/deploy.",
    },
    {
      label: "Upstream reconciliation report",
      status: !upstreamReconciliationReport.exists
        ? "BLOCKED"
        : upstreamReconciliationStatus === "BLOCKED" || unresolvedOverlapCount > 0
          ? "BLOCKED"
          : upstreamReconciliationStatus === "READY"
            ? "PASS"
            : "HOLD",
      evidence: upstreamReconciliationReport.exists
        ? `Reconciliation shows Status: ${upstreamReconciliationStatus || "unknown"}; unresolved overlaps: ${Number.isFinite(unresolvedOverlapCount) ? unresolvedOverlapCount : "unknown"}.`
        : `Missing ${UPSTREAM_RECONCILIATION_REPORT_PATH}.`,
      next: upstreamReconciliationReport.exists && unresolvedOverlapCount === 0
        ? "Remote overlap is represented/superseded locally; branch still needs owner-controlled merge/rebase before push/deploy."
        : "Resolve or explicitly review upstream overlap before commit/push/deploy.",
    },
    {
      label: "Owner merge-readiness report",
      status: !ownerMergeReadinessReport.exists
        ? "BLOCKED"
        : ownerMergeSimulationPassed
          ? ownerMergeReadinessStatus === "READY" ? "PASS" : "HOLD"
          : "BLOCKED",
      evidence: ownerMergeReadinessReport.exists
        ? `Owner merge-readiness shows Status: ${ownerMergeReadinessStatus || "unknown"}; merge simulation: ${ownerMergeSimulationPassed ? "PASS" : "not proven"}.`
        : `Missing ${OWNER_MERGE_READINESS_REPORT_PATH}.`,
      next: ownerMergeReadinessReport.exists && ownerMergeSimulationPassed
        ? "Staged packet can be preserved on the upstream tree; release owner still performs the actual merge/rebase and reruns the release gate."
        : "Run npm run check:commercial-owner-merge-readiness:write and resolve any temporary overlay failure before push/deploy.",
    },
    {
      label: "Release-owner sequence report",
      status: !releaseOwnerSequenceReport.exists
        ? "BLOCKED"
        : releaseOwnerSequenceUsable
          ? releaseOwnerSequenceStatus === "READY" ? "PASS" : "HOLD"
          : "BLOCKED",
      evidence: releaseOwnerSequenceReport.exists
        ? `Release-owner sequence shows Status: ${releaseOwnerSequenceStatus || "unknown"}; owner merge simulation: ${releaseOwnerSequenceUsable ? "PASS" : "not proven"}.`
        : `Missing ${RELEASE_OWNER_SEQUENCE_REPORT_PATH}.`,
      next: releaseOwnerSequenceReport.exists && releaseOwnerSequenceUsable
        ? "Use the ordered owner sequence after branch freshness, then rerun the commercial release gate."
        : "Run npm run check:commercial-release-owner-sequence:write and resolve any sequence blocker before push/deploy.",
    },
    {
      label: "Branch freshness",
      status: repositoryState.branchBehind ? "HOLD" : "PASS",
      evidence: repositoryState.branchLine,
      next: repositoryState.branchBehind
        ? "Review/pull/rebase the remote update before push/deploy, without losing staged work."
        : "Branch is not reported behind remote.",
    },
    {
      label: "Release-impacting unstaged source/config",
      status: releaseImpactingUnstaged.length ? "HOLD" : "PASS",
      evidence: releaseImpactingUnstaged.length
        ? releaseImpactingUnstaged.map((entry) => entry.path).join(", ")
        : "No release-impacting unstaged source/config files outside the staged packet.",
      next: releaseImpactingUnstaged.length
        ? "Stage reviewed source/config changes or intentionally move them out of the release packet before deploy."
        : "The staged packet matches the release-impacting app/config worktree.",
    },
    {
      label: "Unstaged worktree outside packet",
      status: unstagedEntries.length ? "HOLD" : "PASS",
      evidence: `${unstagedEntries.length} unstaged/untracked entries are visible outside the staged packet.`,
      next: unstagedEntries.length
        ? "Commit/push only the staged packet, or separately classify/clean local leftovers before any local deploy."
        : "No unstaged leftovers visible.",
    },
    {
      label: "Held high-risk local artifacts",
      status: highRiskHeld.length ? "HOLD" : "PASS",
      evidence: highRiskHeld.length
        ? highRiskHeld.map((entry) => entry.path).join(", ")
        : "No known high-risk local artifacts visible.",
      next: highRiskHeld.length
        ? "Keep these files unstaged unless explicitly approved: Supabase temp/config/debug artifacts and local tooling."
        : "No high-risk hold files need attention.",
    },
    {
      label: "Deployable Supabase scope",
      status: repositoryState.stagedEntries.some((entry) => entry.path.startsWith("supabase/")) ? "HOLD" : "PASS",
      evidence: repositoryState.stagedEntries
        .filter((entry) => entry.path.startsWith("supabase/"))
        .map((entry) => entry.path)
        .join(", ") || "No staged Supabase files.",
      next: repositoryState.stagedEntries.some((entry) => entry.path.startsWith("supabase/"))
        ? "Before DB/function deploy, apply migration/function deployment deliberately after Supabase owner review."
        : "No Supabase deploy step needed for this packet.",
    },
    {
      label: "Push/deploy ownership",
      status: "HOLD",
      evidence: "This report does not create commits, pushes, Vercel deployments or Supabase deployments.",
      next: "A human operator still chooses commit message, push target, Vercel deploy path, Supabase migration/function deploy path and rollback note.",
    },
  ];
}

async function readReport(path) {
  try {
    return {
      exists: true,
      content: await readFile(path, "utf8"),
    };
  } catch {
    return {
      exists: false,
      content: "",
    };
  }
}

function readNumberLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  const value = Number.parseInt(line?.slice(prefix.length).trim() || "", 10);
  return Number.isFinite(value) ? value : Number.NaN;
}

function readLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  return line?.slice(prefix.length).trim() || "";
}

function isHighRiskHeldPath(path) {
  return (
    path === "supabase/.temp/cli-latest"
    || path === "supabase/config 2.toml"
    || path === "supabase/functions/test-env/index 2.ts"
    || path.startsWith(".agents/")
    || path.startsWith(".codex/")
    || path === "deno.lock"
  );
}

function isReleaseImpactingOutsidePath(path) {
  if (path.startsWith("docs/COMMERCIAL_") && path.endsWith(".md")) return false;
  if (path === "supabase/.temp/cli-latest") return false;
  if (path.startsWith(".agents/") || path.startsWith(".codex/")) return false;
  if (path.startsWith("docs/SUPPLIER_BANK_") || path.startsWith("docs/PIXART_")) return false;
  if (path.startsWith("output/") || path.startsWith("tmp/")) return false;
  if (path === "supabase/config 2.toml" || path === "supabase/functions/test-env/index 2.ts") return false;
  if (
    path === "scripts/apply-product-content-package.js"
    || path === "scripts/apply-product-label-translations.js"
    || path === "scripts/audit-product-source-inventory.cjs"
  ) return false;
  return (
    path.startsWith("src/")
    || path.startsWith("scripts/")
    || path.startsWith("supabase/")
    || path.startsWith("config/")
    || path.startsWith(".github/")
    || path === "package.json"
    || path === "package-lock.json"
    || path === "pnpm-lock.yaml"
    || path === "vite.config.ts"
    || path === ".vercelignore"
  );
}

function getReadinessStatus(checks) {
  if (checks.some((check) => check.status === "BLOCKED")) return "BLOCKED";
  if (checks.some((check) => check.status === "HOLD")) return "HOLD";
  return "READY";
}

async function writeDeployReadinessReport({ reportPath, repositoryState, checks, status }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Deploy Readiness Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${status}`,
    "",
    "This is a local, read-only deploy-readiness artifact. It does not stage, unstage, commit, push, pull, merge, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Decision Summary",
    "",
    `Deploy readiness: ${status}`,
    `Staged entries: ${repositoryState.stagedEntries.length}`,
    `Total dirty entries: ${repositoryState.entries.length}`,
    `Release-impacting unstaged files: ${readinessCheckValue(checks, "Release-impacting unstaged source/config")}`,
    `Branch behind remote: ${repositoryState.branchBehind ? "yes" : "no"}`,
    `Branch ahead of remote: ${repositoryState.branchAhead ? "yes" : "no"}`,
    "",
    "## Readiness Checks",
    "",
    "| Status | Check | Evidence | Next action |",
    "| --- | --- | --- | --- |",
    ...checks.map((check) => `| ${check.status} | ${escapeMarkdownTable(check.label)} | ${escapeMarkdownTable(check.evidence)} | ${escapeMarkdownTable(check.next)} |`),
    "",
    "## Required Next Actions Before Push/Deploy",
    "",
    ...requiredNextActions(checks),
    "",
    "## Operator Commands",
    "",
    "```sh",
    "npm run check:commercial-release",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-release-owner-sequence:write",
    "npm run check:commercial-deploy-readiness:write",
    "npm run check:commercial-deploy-readiness-report",
    "git diff --cached --check",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial deploy readiness report: ${reportPath}`);
}

async function verifyDeployReadinessReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Deploy Readiness Report",
    "This is a local, read-only deploy-readiness artifact.",
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    "Deploy readiness:",
    "Staged entries:",
    "Total dirty entries:",
    "Release-impacting unstaged files:",
    "Branch behind remote:",
    "## Readiness Checks",
    "Release proof",
    "Staged packet safety",
    "Branch freshness report",
    "Upstream reconciliation report",
    "Owner merge-readiness report",
    "Release-owner sequence report",
    "Branch freshness",
    "Release-impacting unstaged source/config",
    "Unstaged worktree outside packet",
    "Held high-risk local artifacts",
    "Deployable Supabase scope",
    "Push/deploy ownership",
    "## Required Next Actions Before Push/Deploy",
    "## Operator Commands",
    "npm run check:commercial-release",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-release-owner-sequence:write",
    "npm run check:commercial-deploy-readiness:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing deploy-readiness report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Deploy-readiness report is missing a valid Status.");
  }

  if (content.includes("| BLOCKED |")) {
    problems.push("Deploy-readiness report contains a BLOCKED check row.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Deploy-readiness report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial deploy-readiness report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial deploy-readiness report check passed: ${path}`);
}

function requiredNextActions(checks) {
  const actions = checks
    .filter((check) => check.status !== "PASS")
    .map((check) => `- ${check.label}: ${check.next}`);
  return actions.length ? actions : ["- No HOLD or BLOCKED checks are visible in this report."];
}

function readinessCheckValue(checks, label) {
  const check = checks.find((entry) => entry.label === label);
  if (!check) return "unknown";
  return check.status === "PASS" ? "0" : check.evidence;
}

function printSummary(repositoryState, checks, status) {
  if (!repositoryState.available) {
    console.warn(repositoryState.error || "Repository state unavailable.");
  }
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${status}`);
  console.log(`Staged entries: ${repositoryState.stagedEntries.length}`);
  for (const check of checks) {
    console.log(`${check.status} ${check.label}: ${check.evidence}`);
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
