#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md";
const RELEASE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_LATEST.md";
const STAGED_PACKET_REPORT_PATH = "docs/COMMERCIAL_STAGED_PACKET_LATEST.md";
const BRANCH_FRESHNESS_REPORT_PATH = "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md";
const UPSTREAM_RECONCILIATION_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const OWNER_MERGE_READINESS_REPORT_PATH = "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial release-owner sequence report.

Usage:
  node scripts/check-commercial-release-owner-sequence.mjs
  node scripts/check-commercial-release-owner-sequence.mjs --write-report
  node scripts/check-commercial-release-owner-sequence.mjs --verify-report

Options:
  --write-report   Write a local markdown release-owner sequence report.
  --verify-report  Verify the local markdown release-owner sequence report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyReleaseOwnerSequenceReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const inputs = await readReportInputs();
const sequence = buildReleaseOwnerSequence(repositoryState, inputs);

if (writeReport) {
  await writeReleaseOwnerSequenceReport({ reportPath, repositoryState, inputs, sequence });
  if (verifyReport) {
    await verifyReleaseOwnerSequenceReport(reportPath);
  }
} else {
  printSummary(repositoryState, sequence);
}

console.log(`Commercial release-owner sequence report check completed: ${sequence.status}.`);

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
  const [release, stagedPacket, branchFreshness, upstreamReconciliation, ownerMergeReadiness] = await Promise.all([
    readReport(RELEASE_REPORT_PATH),
    readReport(STAGED_PACKET_REPORT_PATH),
    readReport(BRANCH_FRESHNESS_REPORT_PATH),
    readReport(UPSTREAM_RECONCILIATION_REPORT_PATH),
    readReport(OWNER_MERGE_READINESS_REPORT_PATH),
  ]);
  return {
    release,
    stagedPacket,
    branchFreshness,
    upstreamReconciliation,
    ownerMergeReadiness,
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

function buildReleaseOwnerSequence(repositoryState, inputs) {
  const releasePassed = inputs.release.content.includes("Status: PASSED");
  const stagedPassed = inputs.stagedPacket.content.includes("Status: PASS")
    && inputs.stagedPacket.content.includes("Forbidden staged files: 0");
  const unresolvedOverlaps = readNumberLine(inputs.upstreamReconciliation.content, "Unresolved overlaps: ");
  const ownerMergeSimulationPassed = inputs.ownerMergeReadiness.content.includes("Merge simulation: PASS")
    && !inputs.ownerMergeReadiness.content.includes("| BLOCKED |");
  const temporaryMergedTree = readLine(inputs.ownerMergeReadiness.content, "Temporary merged tree: ");
  const deployStatus = "generated after release-owner sequence";
  const stagedCount = repositoryState.stagedEntries.length;
  const unstagedCount = repositoryState.entries.filter((entry) => entry.worktreeStatus || entry.status === "??").length;
  const supabaseStaged = repositoryState.stagedEntries.filter((entry) => entry.path.startsWith("supabase/"));
  const blockers = [];

  if (!releasePassed) blockers.push("Latest commercial release report is not PASSED.");
  if (!stagedPassed) blockers.push("Staged packet report does not prove PASS with 0 forbidden staged files.");
  if (!inputs.upstreamReconciliation.exists) blockers.push("Upstream reconciliation report is missing.");
  if (Number.isFinite(unresolvedOverlaps) && unresolvedOverlaps > 0) {
    blockers.push(`${unresolvedOverlaps} upstream overlap(s) remain unresolved.`);
  }
  if (!ownerMergeSimulationPassed) blockers.push("Owner merge-readiness does not prove Merge simulation: PASS.");

  const holds = [
    repositoryState.branchBehind ? "Actual branch freshness step is still pending." : "",
    unstagedCount ? `${unstagedCount} unstaged/untracked entries remain outside the staged packet.` : "",
    supabaseStaged.length ? "Supabase migration/function deployment needs an explicit owner decision." : "",
    "Commit, push, Vercel deploy, Supabase deploy and rollback note are still human-owned.",
  ].filter(Boolean);

  return {
    status: blockers.length ? "BLOCKED" : holds.length ? "HOLD" : "READY",
    releasePassed,
    stagedPassed,
    unresolvedOverlaps,
    ownerMergeSimulationPassed,
    temporaryMergedTree,
    deployStatus,
    stagedCount,
    unstagedCount,
    supabaseStaged,
    blockers,
    holds,
    steps: buildSequenceSteps({ repositoryState, supabaseStaged }),
  };
}

function buildSequenceSteps({ repositoryState, supabaseStaged }) {
  return [
    {
      step: "1",
      owner: "Codex/system",
      status: "done",
      action: "Keep the proof packet verified.",
      command: "npm run check:commercial-release",
      stopRule: "Stop if release report is not PASSED.",
    },
    {
      step: "2",
      owner: "Codex/system",
      status: "done",
      action: "Prove the staged packet overlays cleanly on the upstream tree.",
      command: "npm run check:commercial-owner-merge-readiness:write",
      stopRule: "Stop if Merge simulation is not PASS.",
    },
    {
      step: "3",
      owner: "Release owner",
      status: repositoryState.branchBehind ? "hold" : "ready",
      action: "Freshen the branch while preserving the staged packet.",
      command: "Owner-controlled merge/rebase of origin/ui-cleanup, then rerun npm run check:commercial-release.",
      stopRule: "Stop if staged count, owner merge simulation, or release proof changes unexpectedly.",
    },
    {
      step: "4",
      owner: "Release owner",
      status: "hold",
      action: "Commit only the reviewed staged packet.",
      command: "git diff --cached --check && git commit -m \"chore: add commercial readiness proof gates\"",
      stopRule: "Stop if forbidden local/debug artifacts enter the staged packet.",
    },
    {
      step: "5",
      owner: "Release owner",
      status: "hold",
      action: "Deploy frontend after branch and rollback review.",
      command: "Use the reviewed Vercel path for the committed branch.",
      stopRule: "Stop if Webprinter, Salgsmapper or Onlinetryksager smoke routes fail.",
    },
    {
      step: "6",
      owner: "Supabase owner",
      status: supabaseStaged.length ? "hold" : "ready",
      action: "Deploy Supabase migration/functions only after explicit approval.",
      command: supabaseStaged.length
        ? "Review supabase/config.toml, pricing-read, product-detail-read and migration scope before deploy."
        : "No Supabase deploy step is visible in the staged packet.",
      stopRule: "Stop if function exposure or grant checks fail.",
    },
  ];
}

async function writeReleaseOwnerSequenceReport({ reportPath, repositoryState, inputs, sequence }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Release Owner Sequence Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${sequence.status}`,
    "",
    "This is a local, read-only release-owner sequence artifact. It turns the proof reports into an ordered human release path. It does not stage, unstage, commit, push, pull, merge, rebase, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Sequence Summary",
    "",
    `Release proof status: ${inputs.release.status}`,
    `Staged packet status: ${inputs.stagedPacket.status}`,
    `Staged entries: ${sequence.stagedCount}`,
    `Branch behind remote: ${repositoryState.branchBehind ? "yes" : "no"}`,
    `Upstream reconciliation status: ${inputs.upstreamReconciliation.status}`,
    `Unresolved upstream overlaps: ${Number.isFinite(sequence.unresolvedOverlaps) ? sequence.unresolvedOverlaps : "unknown"}`,
    `Owner merge-readiness status: ${inputs.ownerMergeReadiness.status}`,
    `Owner merge simulation: ${sequence.ownerMergeSimulationPassed ? "PASS" : "not proven"}`,
    `Temporary merged tree: ${sequence.temporaryMergedTree || "not written"}`,
    `Deploy readiness status: ${sequence.deployStatus}`,
    `Unstaged/untracked outside packet: ${sequence.unstagedCount}`,
    "",
    "## Owner Sequence",
    "",
    "| Step | Owner | Status | Action | Command / handoff | Stop rule |",
    "| --- | --- | --- | --- | --- | --- |",
    ...sequence.steps.map((item) => (
      `| ${item.step} | ${escapeMarkdownTable(item.owner)} | ${escapeMarkdownTable(item.status)} | ${escapeMarkdownTable(item.action)} | ${escapeMarkdownTable(item.command)} | ${escapeMarkdownTable(item.stopRule)} |`
    )),
    "",
    "## Stop Rules",
    "",
    ...stopRuleLines(sequence),
    "",
    "## Supabase Scope",
    "",
    ...supabaseScopeLines(sequence),
    "",
    "## Operator Commands",
    "",
    "```sh",
    "npm run check:commercial-release",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-release-owner-sequence:write",
    "npm run check:commercial-deploy-readiness:write",
    "npm run check:commercial-release-handoff:write",
    "git diff --cached --check",
    "```",
    "",
    "## Source Reports",
    "",
    `- Release report: ${inputs.release.path} (${inputs.release.status}, ${inputs.release.generatedAt || "no timestamp"})`,
    `- Staged packet report: ${inputs.stagedPacket.path} (${inputs.stagedPacket.status}, ${inputs.stagedPacket.generatedAt || "no timestamp"})`,
    `- Branch freshness report: ${inputs.branchFreshness.path} (${inputs.branchFreshness.status}, ${inputs.branchFreshness.generatedAt || "no timestamp"})`,
    `- Upstream reconciliation report: ${inputs.upstreamReconciliation.path} (${inputs.upstreamReconciliation.status}, ${inputs.upstreamReconciliation.generatedAt || "no timestamp"})`,
    `- Owner merge-readiness report: ${inputs.ownerMergeReadiness.path} (${inputs.ownerMergeReadiness.status}, ${inputs.ownerMergeReadiness.generatedAt || "no timestamp"})`,
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial release-owner sequence report: ${reportPath}`);
}

function stopRuleLines(sequence) {
  if (sequence.blockers.length) {
    return sequence.blockers.map((item) => `- BLOCKED: ${item}`);
  }
  return [
    "- Do not push or deploy until the branch is freshened by the release owner.",
    "- Do not deploy Supabase migration/functions without explicit owner approval.",
    "- Rerun `npm run check:commercial-release` after branch freshness changes.",
    "- Stop if any tenant smoke route, staged packet guard or Supabase exposure/grant check fails.",
  ];
}

function supabaseScopeLines(sequence) {
  if (!sequence.supabaseStaged.length) {
    return ["- No Supabase files are staged in this packet."];
  }
  return sequence.supabaseStaged.map((entry) => `- ${entry.path}`);
}

async function verifyReleaseOwnerSequenceReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Release Owner Sequence Report",
    "This is a local, read-only release-owner sequence artifact.",
    "Git status command: `git status --short --branch`",
    "Git staged command: `git diff --cached --name-status`",
    "## Sequence Summary",
    "Release proof status:",
    "Staged packet status:",
    "Staged entries:",
    "Branch behind remote:",
    "Owner merge simulation:",
    "Temporary merged tree:",
    "Deploy readiness status:",
    "## Owner Sequence",
    "Freshen the branch while preserving the staged packet.",
    "Commit only the reviewed staged packet.",
    "## Stop Rules",
    "## Supabase Scope",
    "## Operator Commands",
    "npm run check:commercial-release-owner-sequence:write",
    "## Source Reports",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing release-owner sequence report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Release-owner sequence report is missing a valid Status.");
  }

  if (content.includes("| BLOCKED |") || content.includes("- BLOCKED:")) {
    problems.push("Release-owner sequence report contains a BLOCKED item.");
  }

  if (!content.includes("Owner merge simulation: PASS")) {
    problems.push("Release-owner sequence report does not show Owner merge simulation: PASS.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Release-owner sequence report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial release-owner sequence report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial release-owner sequence report check passed: ${path}`);
}

function printSummary(repositoryState, sequence) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${sequence.status}`);
  console.log(`Staged entries: ${sequence.stagedCount}`);
  console.log(`Owner merge simulation: ${sequence.ownerMergeSimulationPassed ? "PASS" : "not proven"}`);
  console.log(`Deploy readiness: ${sequence.deployStatus}`);
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
