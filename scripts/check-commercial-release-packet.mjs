#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_RELEASE_PACKET_LATEST.md";
const REPORTS = [
  {
    key: "release",
    area: "Release proof",
    path: "docs/COMMERCIAL_RELEASE_LATEST.md",
    command: "npm run check:commercial-release-report",
    expected: "Status: PASSED",
    reason: "Confirms the full proof/build gate passed.",
  },
  {
    key: "proof",
    area: "Tenant browser proof",
    path: "docs/COMMERCIAL_PROOF_LATEST.md",
    command: "npm run check:commercial-proof-report",
    expected: "Status: 12/12 tenant proof checks passed",
    reason: "Shows Webprinter, site package preview, Salgsmapper and Onlinetryksager proof routes.",
  },
  {
    key: "changeset",
    area: "Changeset review",
    path: "docs/COMMERCIAL_CHANGESET_LATEST.md",
    command: "npm run check:commercial-changeset-report",
    expected: "# Commercial Changeset Report",
    reason: "Groups the dirty worktree into review buckets.",
  },
  {
    key: "applicationSource",
    area: "Application source",
    path: "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
    command: "npm run check:commercial-application-source-report",
    expected: "# Commercial Application Source Report",
    reason: "Separates runtime app changes from pricing/POD guardrails.",
  },
  {
    key: "supabase",
    area: "Supabase scope",
    path: "docs/COMMERCIAL_SUPABASE_LATEST.md",
    command: "npm run check:commercial-supabase-report",
    expected: "Status: REVIEW REQUIRED",
    reason: "Shows grant/function checks plus migration/function deployment scope.",
  },
  {
    key: "stagedPacket",
    area: "Staged packet",
    path: "docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
    command: "npm run check:commercial-staged-packet-report",
    expected: "Status: PASS",
    reason: "Proves forbidden local/debug artifacts are not staged.",
  },
  {
    key: "branchFreshness",
    area: "Branch freshness",
    path: "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
    command: "npm run check:commercial-branch-freshness-report",
    expected: "Status: HOLD",
    reason: "Makes the upstream-only commit and staged overlap visible.",
  },
  {
    key: "upstreamReconciliation",
    area: "Upstream reconciliation",
    path: "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
    command: "npm run check:commercial-upstream-reconciliation-report",
    expected: "Unresolved overlaps: 0",
    reason: "Shows remote overlap is exact, represented or superseded.",
  },
  {
    key: "ownerMergeReadiness",
    area: "Owner merge-readiness",
    path: "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
    command: "npm run check:commercial-owner-merge-readiness-report",
    expected: "Merge simulation: PASS",
    reason: "Proves the staged packet overlays on the upstream tree.",
  },
  {
    key: "releaseOwnerSequence",
    area: "Release-owner sequence",
    path: "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
    command: "npm run check:commercial-release-owner-sequence-report",
    expected: "Owner merge simulation: PASS",
    reason: "Gives the human branch, commit and deploy sequence.",
  },
  {
    key: "deployReadiness",
    area: "Deploy readiness",
    path: "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
    command: "npm run check:commercial-deploy-readiness-report",
    expected: "Deploy readiness: HOLD",
    reason: "Summarizes push/deploy holds and owner decisions.",
  },
  {
    key: "releaseHandoff",
    area: "Release handoff",
    path: "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
    command: "npm run check:commercial-release-handoff-report",
    expected: "Status: HOLD",
    reason: "Contains commit suggestion, rollback note and smoke routes.",
  },
];
const GENERATED_REPORT_PATHS = new Set([
  DEFAULT_REPORT_PATH,
  ...REPORTS.map((report) => report.path),
]);

const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial release packet index.

Usage:
  node scripts/check-commercial-release-packet.mjs
  node scripts/check-commercial-release-packet.mjs --write-report
  node scripts/check-commercial-release-packet.mjs --verify-report

Options:
  --write-report   Write a local markdown release packet index.
  --verify-report  Verify the local markdown release packet index structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyReleasePacketReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const reportInputs = await readReportInputs();
const packet = buildReleasePacket(repositoryState, reportInputs);

if (writeReport) {
  await writeReleasePacketReport({ reportPath, repositoryState, reportInputs, packet });
  if (verifyReport) {
    await verifyReleasePacketReport(reportPath);
  }
} else {
  printSummary(repositoryState, packet);
}

console.log(`Commercial release packet index check completed: ${packet.status}.`);

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
    entries,
    stagedEntries,
    stagedWorktreeDriftEntries: entries.filter((entry) => (
      stagedEntries.some((stagedEntry) => stagedEntry.path === entry.path)
      && Boolean(entry.worktreeStatus)
      && !isGeneratedCommercialReportPath(entry.path)
    )),
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
  const entries = await Promise.all(REPORTS.map(async (report) => [report.key, await readReport(report)]));
  return Object.fromEntries(entries);
}

async function readReport(report) {
  try {
    const content = await readFile(report.path, "utf8");
    return {
      ...report,
      exists: true,
      content,
      status: readStatus(content),
      generatedAt: readLine(content, "Generated: "),
      expectedPresent: content.includes(report.expected),
    };
  } catch {
    return {
      ...report,
      exists: false,
      content: "",
      status: "missing",
      generatedAt: "",
      expectedPresent: false,
    };
  }
}

function readStatus(content) {
  return readLine(content, "Status: ") || "unknown";
}

function isGeneratedCommercialReportPath(path) {
  return path.startsWith("docs/COMMERCIAL_") && path.endsWith(".md");
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

function buildReleasePacket(repositoryState, reportInputs) {
  const releaseReady = reportInputs.release.expectedPresent;
  const proofReady = reportInputs.proof.expectedPresent;
  const stagedReady = reportInputs.stagedPacket.expectedPresent
    && reportInputs.stagedPacket.content.includes("Forbidden staged files: 0");
  const unresolvedOverlaps = readNumberLine(reportInputs.upstreamReconciliation.content, "Unresolved overlaps: ");
  const ownerMergeSimulationPassed = reportInputs.ownerMergeReadiness.content.includes("Merge simulation: PASS")
    && !reportInputs.ownerMergeReadiness.content.includes("| BLOCKED |");
  const deployStatus = readLine(reportInputs.deployReadiness.content, "Deploy readiness: ") || reportInputs.deployReadiness.status;
  const branchOverlapCount = readNumberLine(reportInputs.branchFreshness.content, "Overlaps with staged packet: ");
  const unstagedCount = repositoryState.entries.filter((entry) => (
    (entry.worktreeStatus || entry.status === "??")
    && !GENERATED_REPORT_PATHS.has(entry.path)
  )).length;
  const releaseImpactingUnstaged = repositoryState.entries.filter((entry) => (
    (entry.worktreeStatus || entry.status === "??")
    && isReleaseImpactingOutsidePath(entry.path)
    && !GENERATED_REPORT_PATHS.has(entry.path)
  ));
  const stagedWorktreeDriftCount = repositoryState.stagedWorktreeDriftEntries.length;
  const supabaseStaged = repositoryState.stagedEntries.filter((entry) => entry.path.startsWith("supabase/"));
  const missingReports = Object.values(reportInputs).filter((report) => !report.exists);
  const blockers = [];

  if (missingReports.length) blockers.push(`${missingReports.length} required packet report(s) are missing.`);
  if (!releaseReady) blockers.push("Release proof report does not show Status: PASSED.");
  if (!proofReady) blockers.push("Tenant proof report does not show 12/12 checks passed.");
  if (!stagedReady) blockers.push("Staged packet report does not prove PASS with 0 forbidden files.");
  if (Number.isFinite(unresolvedOverlaps) && unresolvedOverlaps > 0) {
    blockers.push(`${unresolvedOverlaps} upstream overlap(s) are unresolved.`);
  }
  if (!ownerMergeSimulationPassed) blockers.push("Owner merge-readiness does not show Merge simulation: PASS.");

  const holds = [
    repositoryState.branchBehind ? "Branch is behind remote and requires owner-controlled freshness work." : "",
    reportInputs.branchFreshness.status === "HOLD"
      ? `Branch freshness is HOLD with ${Number.isFinite(branchOverlapCount) ? branchOverlapCount : "unknown"} staged overlap(s).`
      : "",
    reportInputs.upstreamReconciliation.status === "HOLD"
      ? `Upstream reconciliation is HOLD with ${Number.isFinite(unresolvedOverlaps) ? unresolvedOverlaps : "unknown"} unresolved overlap(s).`
      : "",
    reportInputs.supabase.status === "REVIEW REQUIRED" ? "Supabase scope is REVIEW REQUIRED before DB/function deploy." : "",
    reportInputs.releaseOwnerSequence.status === "HOLD" ? "Release-owner sequence is HOLD until branch/commit/deploy owner work is done." : "",
    deployStatus === "HOLD" ? "Deploy readiness is HOLD until push/deploy ownership decisions are made." : "",
    reportInputs.releaseHandoff.status === "HOLD" ? "Release handoff is HOLD until the human owner executes the release sequence." : "",
    stagedWorktreeDriftCount ? `${stagedWorktreeDriftCount} staged file(s) also have unstaged working-tree changes.` : "",
    releaseImpactingUnstaged.length ? `${releaseImpactingUnstaged.length} release-impacting unstaged source/config file(s) remain outside the packet.` : "",
    unstagedCount ? `${unstagedCount} unstaged/untracked entries remain outside the staged packet.` : "",
    supabaseStaged.length ? "Supabase migration/function files are staged and need explicit deploy approval." : "",
  ].filter(Boolean);

  return {
    status: blockers.length ? "BLOCKED" : holds.length ? "HOLD" : "READY",
    releaseReady,
    proofReady,
    stagedReady,
    unresolvedOverlaps,
    ownerMergeSimulationPassed,
    deployStatus,
    stagedCount: repositoryState.stagedEntries.length,
    unstagedCount,
    releaseImpactingUnstagedCount: releaseImpactingUnstaged.length,
    stagedWorktreeDriftCount,
    supabaseStaged,
    blockers,
    holds,
  };
}

async function writeReleasePacketReport({ reportPath, repositoryState, reportInputs, packet }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Release Packet Index",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${packet.status}`,
    "",
    "This is a local, read-only release packet index artifact. It does not stage, unstage, commit, push, pull, merge, rebase, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Executive Snapshot",
    "",
    `Release proof: ${packet.releaseReady ? "PASS" : "not proven"}`,
    `Tenant browser proof: ${packet.proofReady ? "PASS" : "not proven"}`,
    `Staged packet: ${packet.stagedReady ? "PASS" : "not proven"}`,
    `Staged entries: ${packet.stagedCount}`,
    `Branch behind remote: ${repositoryState.branchBehind ? "yes" : "no"}`,
    `Unresolved upstream overlaps: ${Number.isFinite(packet.unresolvedOverlaps) ? packet.unresolvedOverlaps : "unknown"}`,
    `Owner merge simulation: ${packet.ownerMergeSimulationPassed ? "PASS" : "not proven"}`,
    `Deploy readiness: ${packet.deployStatus}`,
    `Staged file drift: ${packet.stagedWorktreeDriftCount}`,
    `Release-impacting unstaged files: ${packet.releaseImpactingUnstagedCount}`,
    `Unstaged/untracked outside packet: ${packet.unstagedCount}`,
    `Supabase staged files: ${packet.supabaseStaged.length}`,
    "",
    "## Report Index",
    "",
    "| State | Area | Report | Command | Why open it |",
    "| --- | --- | --- | --- | --- |",
    ...REPORTS.map((report) => reportIndexLine(reportInputs[report.key])),
    "",
    "## Current Holds",
    "",
    ...packetHoldLines(packet),
    "",
    "## Owner Stop Rules",
    "",
    "- Open this packet first, then open `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md` for the operational release sequence.",
    "- Do not push or deploy until the branch is freshened by the release owner.",
    "- Do not deploy Supabase migration/functions without explicit owner approval.",
    "- Rerun `npm run check:commercial-release` and `npm run check:commercial-release-packet:write` after branch freshness changes.",
    "- Stop if tenant browser proof, staged-packet guard, owner merge simulation, Supabase exposure or Supabase grants fail.",
    "",
    "## Operator Commands",
    "",
    "```sh",
    "npm run check:commercial-release",
    "npm run check:commercial-release-packet:write",
    "npm run check:commercial-release-packet-report",
    "npm run check:commercial-release-handoff-report",
    "git diff --cached --check",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial release packet index: ${reportPath}`);
}

function reportIndexLine(report) {
  const state = reportState(report);
  return [
    state,
    report.area,
    report.path,
    report.command,
    report.reason,
  ].map(escapeMarkdownTable).join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function reportState(report) {
  if (!report.exists) return "MISSING";
  if (report.content.includes("Status: BLOCKED") || report.content.includes("| BLOCKED |") || report.content.includes("- BLOCKED:")) {
    return "BLOCKED";
  }
  if (report.expectedPresent) {
    if (report.status === "HOLD") return "HOLD";
    if (report.status === "REVIEW REQUIRED") return "REVIEW";
    return "PASS";
  }
  return "REVIEW";
}

function packetHoldLines(packet) {
  if (packet.blockers.length) {
    return packet.blockers.map((item) => `- BLOCKED: ${item}`);
  }
  if (packet.holds.length) {
    return packet.holds.map((item) => `- HOLD: ${item}`);
  }
  return ["- READY: No release packet holds detected."];
}

async function verifyReleasePacketReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Release Packet Index",
    "This is a local, read-only release packet index artifact.",
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    "## Executive Snapshot",
    "Release proof:",
    "Tenant browser proof:",
    "Staged packet:",
    "Owner merge simulation:",
    "Deploy readiness:",
    "Staged file drift:",
    "Release-impacting unstaged files:",
    "## Report Index",
    "docs/COMMERCIAL_RELEASE_LATEST.md",
    "docs/COMMERCIAL_PROOF_LATEST.md",
    "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
    "## Current Holds",
    "## Owner Stop Rules",
    "## Operator Commands",
    "npm run check:commercial-release-packet:write",
    "npm run check:commercial-release-packet-report",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing release packet marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Release packet report is missing a valid Status.");
  }

  if (content.includes("Status: BLOCKED") || content.includes("| BLOCKED |") || content.includes("- BLOCKED:")) {
    problems.push("Release packet report contains a BLOCKED item.");
  }

  if (!content.includes("Release proof: PASS")) {
    problems.push("Release packet report does not show Release proof: PASS.");
  }

  if (!content.includes("Tenant browser proof: PASS")) {
    problems.push("Release packet report does not show Tenant browser proof: PASS.");
  }

  if (!content.includes("Staged packet: PASS")) {
    problems.push("Release packet report does not show Staged packet: PASS.");
  }

  if (!content.includes("Owner merge simulation: PASS")) {
    problems.push("Release packet report does not show Owner merge simulation: PASS.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Release packet report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial release packet report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial release packet report check passed: ${path}`);
}

function printSummary(repositoryState, packet) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${packet.status}`);
  console.log(`Release proof: ${packet.releaseReady ? "PASS" : "not proven"}`);
  console.log(`Tenant browser proof: ${packet.proofReady ? "PASS" : "not proven"}`);
  console.log(`Staged entries: ${packet.stagedCount}`);
  console.log(`Owner merge simulation: ${packet.ownerMergeSimulationPassed ? "PASS" : "not proven"}`);
  console.log(`Deploy readiness: ${packet.deployStatus}`);
  console.log(`Staged file drift: ${packet.stagedWorktreeDriftCount}`);
  console.log(`Release-impacting unstaged files: ${packet.releaseImpactingUnstagedCount}`);
}

function isReleaseImpactingOutsidePath(path) {
  if (isGeneratedCommercialReportPath(path)) return false;
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

function escapeMarkdownTable(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}
