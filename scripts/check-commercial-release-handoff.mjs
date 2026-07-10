#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md";
const RELEASE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_LATEST.md";
const DEPLOY_READINESS_REPORT_PATH = "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md";
const STAGED_PACKET_REPORT_PATH = "docs/COMMERCIAL_STAGED_PACKET_LATEST.md";
const BRANCH_FRESHNESS_REPORT_PATH = "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md";
const UPSTREAM_RECONCILIATION_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const OWNER_MERGE_READINESS_REPORT_PATH = "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md";
const RELEASE_OWNER_SEQUENCE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial release handoff report.

Usage:
  node scripts/check-commercial-release-handoff.mjs
  node scripts/check-commercial-release-handoff.mjs --write-report
  node scripts/check-commercial-release-handoff.mjs --verify-report

Options:
  --write-report   Write a local markdown release handoff report.
  --verify-report  Verify the local markdown release handoff report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyReleaseHandoffReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const reportInputs = await readReportInputs();
const handoff = buildReleaseHandoff(repositoryState, reportInputs);

if (writeReport) {
  await writeReleaseHandoffReport({ reportPath, repositoryState, reportInputs, handoff });
  if (verifyReport) {
    await verifyReleaseHandoffReport(reportPath);
  }
} else {
  printSummary(repositoryState, reportInputs, handoff);
}

console.log(`Commercial release handoff report check completed: ${handoff.status}.`);

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
  const [statusResult, stagedResult, headResult] = await Promise.all([
    runQuietCommand("git", ["status", "--short", "--branch"]),
    runQuietCommand("git", ["diff", "--cached", "--name-status"]),
    runQuietCommand("git", ["rev-parse", "--short", "HEAD"]),
  ]);
  const lines = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("##")) || "unknown";
  const entries = lines
    .filter((line) => !line.startsWith("##"))
    .map(parseStatusEntry);
  const stagedEntries = stagedResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseStagedEntry);

  return {
    branchLine,
    branchBehind: branchLine.includes("[behind"),
    branchAhead: branchLine.includes("[ahead"),
    entries,
    stagedEntries,
    headCommit: (headResult.stdout || "unknown").trim() || "unknown",
  };
}

function parseStatusEntry(line) {
  const status = line.slice(0, 2);
  return {
    line,
    indexStatus: status[0]?.trim() || "",
    worktreeStatus: status[1]?.trim() || "",
    status: status.trim() || "??",
    path: normalizeStatusPath(line.slice(3).trim()),
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

async function readReportInputs() {
  const [
    release,
    deployReadiness,
    stagedPacket,
    branchFreshness,
    upstreamReconciliation,
    ownerMergeReadiness,
    releaseOwnerSequence,
  ] = await Promise.all([
    readReport(RELEASE_REPORT_PATH),
    readReport(DEPLOY_READINESS_REPORT_PATH),
    readReport(STAGED_PACKET_REPORT_PATH),
    readReport(BRANCH_FRESHNESS_REPORT_PATH),
    readReport(UPSTREAM_RECONCILIATION_REPORT_PATH),
    readReport(OWNER_MERGE_READINESS_REPORT_PATH),
    readReport(RELEASE_OWNER_SEQUENCE_REPORT_PATH),
  ]);
  return {
    release,
    deployReadiness,
    stagedPacket,
    branchFreshness,
    upstreamReconciliation,
    ownerMergeReadiness,
    releaseOwnerSequence,
  };
}

async function readReport(path) {
  try {
    const content = await readFile(path, "utf8");
    return {
      path,
      exists: true,
      content,
      status: readStatus(content),
      generatedAt: readLine(content, "Generated: "),
    };
  } catch {
    return {
      path,
      exists: false,
      content: "",
      status: "missing",
      generatedAt: "",
    };
  }
}

function readStatus(content) {
  return readLine(content, "Status: ") || "unknown";
}

function readLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  return line?.slice(prefix.length).trim() || "";
}

function readNumberLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  const value = Number.parseInt(line?.slice(prefix.length).trim() || "", 10);
  return Number.isFinite(value) ? value : Number.NaN;
}

function buildReleaseHandoff(repositoryState, reportInputs) {
  const releasePassed = reportInputs.release.content.includes("Status: PASSED");
  const deployStatus = reportInputs.deployReadiness.status;
  const branchFreshnessStatus = reportInputs.branchFreshness.status;
  const branchOverlapCount = readNumberLine(reportInputs.branchFreshness.content, "Overlaps with staged packet: ");
  const upstreamReconciliationStatus = reportInputs.upstreamReconciliation.status;
  const unresolvedOverlapCount = readNumberLine(reportInputs.upstreamReconciliation.content, "Unresolved overlaps: ");
  const ownerMergeReadinessStatus = reportInputs.ownerMergeReadiness.status;
  const ownerMergeSimulationPassed = reportInputs.ownerMergeReadiness.content.includes("Merge simulation: PASS")
    && !reportInputs.ownerMergeReadiness.content.includes("| BLOCKED |");
  const releaseOwnerSequenceStatus = reportInputs.releaseOwnerSequence.status;
  const releaseOwnerSequenceUsable = reportInputs.releaseOwnerSequence.content.includes("Owner merge simulation: PASS")
    && reportInputs.releaseOwnerSequence.content.includes("Freshen the branch while preserving the staged packet.")
    && !reportInputs.releaseOwnerSequence.content.includes("| BLOCKED |")
    && !reportInputs.releaseOwnerSequence.content.includes("- BLOCKED:");
  const stagedForbidden = reportInputs.stagedPacket.content.includes("Forbidden staged files: 0");
  const stagedCount = repositoryState.stagedEntries.length;
  const unstagedCount = repositoryState.entries.filter((entry) => entry.worktreeStatus || entry.status === "??").length;
  const releaseImpactingUnstaged = repositoryState.entries.filter((entry) => (
    (entry.worktreeStatus || entry.status === "??")
    && isReleaseImpactingOutsidePath(entry.path)
  ));
  const supabaseStaged = repositoryState.stagedEntries.filter((entry) => entry.path.startsWith("supabase/"));
  const blockers = [];

  if (!releasePassed) blockers.push("Latest commercial release proof is not PASSED.");
  if (!stagedForbidden) blockers.push("Staged packet safety is not proven with 0 forbidden files.");
  if (deployStatus === "BLOCKED") blockers.push("Deploy readiness contains a BLOCKED check.");
  if (!reportInputs.branchFreshness.exists) blockers.push("Branch freshness report is missing.");
  if (!reportInputs.upstreamReconciliation.exists) blockers.push("Upstream reconciliation report is missing.");
  if (!reportInputs.ownerMergeReadiness.exists) blockers.push("Owner merge-readiness report is missing.");
  if (reportInputs.ownerMergeReadiness.exists && !ownerMergeSimulationPassed) {
    blockers.push("Owner merge-readiness report does not prove the staged packet overlays on upstream.");
  }
  if (!reportInputs.releaseOwnerSequence.exists) blockers.push("Release-owner sequence report is missing.");
  if (reportInputs.releaseOwnerSequence.exists && !releaseOwnerSequenceUsable) {
    blockers.push("Release-owner sequence report does not prove an ordered non-blocked owner path.");
  }
  if (Number.isFinite(unresolvedOverlapCount) && unresolvedOverlapCount > 0) {
    blockers.push(`${unresolvedOverlapCount} upstream overlap(s) are unresolved.`);
  }

  const holds = [
    repositoryState.branchBehind ? "Branch is behind remote and needs owner review before push/deploy." : "",
    branchFreshnessStatus === "HOLD"
      ? `Branch freshness report is HOLD with ${Number.isFinite(branchOverlapCount) ? branchOverlapCount : "unknown"} staged overlap(s).`
      : "",
    upstreamReconciliationStatus === "HOLD"
      ? `Upstream reconciliation is HOLD with ${Number.isFinite(unresolvedOverlapCount) ? unresolvedOverlapCount : "unknown"} unresolved overlap(s).`
      : "",
    ownerMergeReadinessStatus === "HOLD"
      ? "Owner merge-readiness is HOLD because the actual release-owner merge/rebase is still pending."
      : "",
    releaseOwnerSequenceStatus === "HOLD"
      ? "Release-owner sequence is HOLD because human branch/commit/deploy ownership is still pending."
      : "",
    releaseImpactingUnstaged.length ? `${releaseImpactingUnstaged.length} release-impacting unstaged source/config file(s) remain outside the staged packet.` : "",
    unstagedCount ? `${unstagedCount} unstaged/untracked entries remain outside the staged packet.` : "",
    supabaseStaged.length ? "Supabase migration/function changes require deliberate deploy-owner review." : "",
    "Commit message, push target, Vercel deploy path, Supabase deploy path and rollback note still need human ownership.",
  ].filter(Boolean);

  return {
    status: blockers.length ? "BLOCKED" : holds.length ? "HOLD" : "READY",
    releasePassed,
    deployStatus,
    branchFreshnessStatus,
    branchOverlapCount,
    upstreamReconciliationStatus,
    unresolvedOverlapCount,
    ownerMergeReadinessStatus,
    ownerMergeSimulationPassed,
    releaseOwnerSequenceStatus,
    releaseOwnerSequenceUsable,
    stagedForbidden,
    stagedCount,
    unstagedCount,
    releaseImpactingUnstagedCount: releaseImpactingUnstaged.length,
    supabaseStaged,
    blockers,
    holds,
    suggestedCommitSubject: "chore: add commercial readiness proof gates",
  };
}

async function writeReleaseHandoffReport({ reportPath, repositoryState, reportInputs, handoff }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Release Handoff Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${handoff.status}`,
    "",
    "This is a local, read-only release-handoff artifact. It does not stage, unstage, commit, push, pull, merge, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Handoff Summary",
    "",
    `Release proof status: ${reportInputs.release.status}`,
    `Branch freshness status: ${reportInputs.branchFreshness.status}`,
    `Branch staged overlap count: ${Number.isFinite(handoff.branchOverlapCount) ? handoff.branchOverlapCount : "unknown"}`,
    `Upstream reconciliation status: ${reportInputs.upstreamReconciliation.status}`,
    `Unresolved upstream overlaps: ${Number.isFinite(handoff.unresolvedOverlapCount) ? handoff.unresolvedOverlapCount : "unknown"}`,
    `Owner merge-readiness status: ${reportInputs.ownerMergeReadiness.status}`,
    `Owner merge simulation: ${handoff.ownerMergeSimulationPassed ? "PASS" : "not proven"}`,
    `Release-owner sequence status: ${reportInputs.releaseOwnerSequence.status}`,
    `Release-owner sequence usable: ${handoff.releaseOwnerSequenceUsable ? "yes" : "no"}`,
    `Deploy readiness status: ${reportInputs.deployReadiness.status}`,
    `Staged packet safety: ${handoff.stagedForbidden ? "0 forbidden staged files" : "not proven"}`,
    `Staged entries: ${handoff.stagedCount}`,
    `Release-impacting unstaged files: ${handoff.releaseImpactingUnstagedCount}`,
    `Unstaged/untracked outside packet: ${handoff.unstagedCount}`,
    `Current HEAD before commit: ${repositoryState.headCommit}`,
    "",
    "## Suggested Commit",
    "",
    `Subject: \`${handoff.suggestedCommitSubject}\``,
    "",
    "Suggested body:",
    "",
    "```text",
    "Adds the commercial readiness proof chain, staged-packet safety report, deploy-readiness decision report, tenant proof artifacts, and reviewed app/Supabase packet.",
    "",
    "Verification:",
    "- npm run check:commercial-release",
    "- npm run check:commercial-owner-merge-readiness:write",
    "- npm run check:commercial-release-owner-sequence:write",
    "- npm run check:commercial-deploy-readiness:write",
    "- git diff --cached --check",
    "```",
    "",
    "## Required Owner Decisions",
    "",
    ...ownerDecisionLines(handoff),
    "",
    "## Supabase Deploy Scope",
    "",
    ...supabaseScopeLines(handoff),
    "",
    "## Rollback Note Template",
    "",
    "```text",
    "Release owner:",
    "Commit deployed:",
    "Previous known-good production state:",
    "Vercel rollback path:",
    "Supabase rollback path:",
    "Tenant smoke routes checked after deploy:",
    "- https://www.webprinter.dk/",
    "- https://www.salgsmapper.dk/",
    "- https://www.onlinetryksager.dk/",
    "Stop condition:",
    "```",
    "",
    "## Operator Sequence",
    "",
    "```sh",
    "npm run check:commercial-release",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-release-owner-sequence:write",
    "npm run check:commercial-deploy-readiness:write",
    "npm run check:commercial-release-handoff:write",
    "git diff --cached --check",
    "# human-owned after branch/rollback review:",
    "# git commit -m \"chore: add commercial readiness proof gates\"",
    "# git push <reviewed-remote> <reviewed-branch>",
    "```",
    "",
    "## Source Reports",
    "",
    `- Release report: ${reportInputs.release.path} (${reportInputs.release.status}, ${reportInputs.release.generatedAt || "no timestamp"})`,
    `- Branch freshness report: ${reportInputs.branchFreshness.path} (${reportInputs.branchFreshness.status}, ${reportInputs.branchFreshness.generatedAt || "no timestamp"})`,
    `- Upstream reconciliation report: ${reportInputs.upstreamReconciliation.path} (${reportInputs.upstreamReconciliation.status}, ${reportInputs.upstreamReconciliation.generatedAt || "no timestamp"})`,
    `- Owner merge-readiness report: ${reportInputs.ownerMergeReadiness.path} (${reportInputs.ownerMergeReadiness.status}, ${reportInputs.ownerMergeReadiness.generatedAt || "no timestamp"})`,
    `- Release-owner sequence report: ${reportInputs.releaseOwnerSequence.path} (${reportInputs.releaseOwnerSequence.status}, ${reportInputs.releaseOwnerSequence.generatedAt || "no timestamp"})`,
    `- Deploy readiness report: ${reportInputs.deployReadiness.path} (${reportInputs.deployReadiness.status}, ${reportInputs.deployReadiness.generatedAt || "no timestamp"})`,
    `- Staged packet report: ${reportInputs.stagedPacket.path} (${reportInputs.stagedPacket.status}, ${reportInputs.stagedPacket.generatedAt || "no timestamp"})`,
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial release handoff report: ${reportPath}`);
}

function ownerDecisionLines(handoff) {
  const lines = [];
  if (handoff.blockers.length) {
    lines.push("### Blockers");
    lines.push("");
    lines.push(...handoff.blockers.map((item) => `- ${item}`));
    lines.push("");
  }
  if (handoff.holds.length) {
    lines.push("### Holds");
    lines.push("");
    lines.push(...handoff.holds.map((item) => `- ${item}`));
    return lines;
  }
  return ["- No HOLD or BLOCKED owner decisions are visible in this report."];
}

function supabaseScopeLines(handoff) {
  if (!handoff.supabaseStaged.length) {
    return ["- No Supabase files are staged in this packet."];
  }
  return [
    "The staged packet includes Supabase deploy-review files. Do not apply them implicitly with a frontend push.",
    "",
    ...handoff.supabaseStaged.map((entry) => `- ${entry.path}`),
  ];
}

async function verifyReleaseHandoffReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Release Handoff Report",
    "This is a local, read-only release-handoff artifact.",
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    "## Handoff Summary",
    "Release proof status:",
    "Branch freshness status:",
    "Branch staged overlap count:",
    "Upstream reconciliation status:",
    "Unresolved upstream overlaps:",
    "Owner merge-readiness status:",
    "Owner merge simulation:",
    "Release-owner sequence status:",
    "Release-owner sequence usable:",
    "Deploy readiness status:",
    "Staged packet safety:",
    "Release-impacting unstaged files:",
    "## Suggested Commit",
    "chore: add commercial readiness proof gates",
    "## Required Owner Decisions",
    "## Supabase Deploy Scope",
    "## Rollback Note Template",
    "Previous known-good production state:",
    "Vercel rollback path:",
    "Supabase rollback path:",
    "## Operator Sequence",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-release-owner-sequence:write",
    "npm run check:commercial-release-handoff:write",
    "## Source Reports",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing release-handoff report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Release-handoff report is missing a valid Status.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Release-handoff report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial release handoff report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial release handoff report check passed: ${path}`);
}

function printSummary(repositoryState, reportInputs, handoff) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${handoff.status}`);
  console.log(`Release report: ${reportInputs.release.status}`);
  console.log(`Branch freshness: ${reportInputs.branchFreshness.status}`);
  console.log(`Deploy readiness: ${reportInputs.deployReadiness.status}`);
  console.log(`Staged entries: ${handoff.stagedCount}`);
  console.log(`Release-impacting unstaged files: ${handoff.releaseImpactingUnstagedCount}`);
  console.log(`Unstaged/untracked outside packet: ${handoff.unstagedCount}`);
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
