#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md";
const UPSTREAM_RECONCILIATION_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial owner merge-readiness report.

Usage:
  node scripts/check-commercial-owner-merge-readiness.mjs
  node scripts/check-commercial-owner-merge-readiness.mjs --write-report
  node scripts/check-commercial-owner-merge-readiness.mjs --verify-report

Options:
  --write-report   Write a local markdown owner merge-readiness report.
  --verify-report  Verify the local markdown owner merge-readiness report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyOwnerMergeReadinessReport(reportPath);
  process.exit(0);
}

const readiness = await buildOwnerMergeReadiness();

if (writeReport) {
  await writeOwnerMergeReadinessReport({ reportPath, readiness });
  if (verifyReport) {
    await verifyOwnerMergeReadinessReport(reportPath);
  }
} else {
  printSummary(readiness);
}

console.log(`Commercial owner merge-readiness report check completed: ${readiness.status}.`);

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

async function buildOwnerMergeReadiness() {
  const [
    statusResult,
    upstreamResult,
    headResult,
    stagedResult,
    stagedNameStatusResult,
    reconciliationReport,
  ] = await Promise.all([
    runQuietCommand("git", ["status", "--short", "--branch"]),
    runQuietCommand("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
    runQuietCommand("git", ["rev-parse", "--short", "HEAD"]),
    runQuietCommand("git", ["ls-files", "-s"]),
    runQuietCommand("git", ["diff", "--cached", "--name-status", "-z"]),
    readReport(UPSTREAM_RECONCILIATION_REPORT_PATH),
  ]);

  const statusLines = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = statusLines.find((line) => line.startsWith("##")) || "unknown";
  const upstream = upstreamResult.code === 0 ? upstreamResult.stdout.trim() : "";
  const stagedEntries = parseNameStatusZ(stagedNameStatusResult.stdout);
  const blockers = [];
  const holds = [];

  if (!upstream) {
    blockers.push("No configured upstream branch was found.");
  }

  const [remoteCommitResult, remoteDiffResult, upstreamCommitResult] = upstream
    ? await Promise.all([
      runQuietCommand("git", ["log", "--oneline", `HEAD..${upstream}`]),
      runQuietCommand("git", ["diff", "--name-status", `HEAD..${upstream}`]),
      runQuietCommand("git", ["rev-parse", "--short", upstream]),
    ])
    : [
      { code: 0, stdout: "", stderr: "" },
      { code: 0, stdout: "", stderr: "" },
      { code: 1, stdout: "", stderr: "" },
    ];

  const remoteCommits = remoteCommitResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const remoteEntries = remoteDiffResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseNameStatusLine);
  const reconciliationStatus = readLine(reconciliationReport.content, "Status: ");
  const unresolvedOverlaps = readNumberLine(reconciliationReport.content, "Unresolved overlaps: ");
  const reconciliationOk = reconciliationReport.exists
    && reconciliationStatus !== "BLOCKED"
    && Number.isFinite(unresolvedOverlaps)
    && unresolvedOverlaps === 0;

  if (reconciliationReport.exists && !reconciliationOk) {
    blockers.push("Upstream reconciliation report does not prove 0 unresolved overlaps.");
  }
  if (!reconciliationReport.exists) {
    holds.push(`Missing ${UPSTREAM_RECONCILIATION_REPORT_PATH}; run npm run check:commercial-upstream-reconciliation:write.`);
  }

  const simulation = upstream
    ? await simulateStagedOverlayOnUpstream({
      upstream,
      stagedEntries,
      stagedIndexListing: stagedResult.stdout,
    })
    : {
      ok: false,
      temporaryTree: "",
      overlayEntries: [],
      error: "Missing upstream branch.",
    };

  if (!simulation.ok) {
    blockers.push(`Temporary upstream overlay failed: ${simulation.error || "unknown error"}`);
  }

  if (remoteCommits.length > 0) {
    holds.push(`${remoteCommits.length} upstream commit(s) still require release-owner merge/rebase before push/deploy.`);
  }
  if (branchLine.includes("[behind")) {
    holds.push("Branch is still behind remote; this report is proof for the owner step, not the step itself.");
  }
  if (stagedEntries.length === 0) {
    holds.push("No staged commercial packet entries are present to overlay.");
  }

  return {
    status: blockers.length ? "BLOCKED" : holds.length ? "HOLD" : "READY",
    branchLine,
    upstream: upstream || "missing",
    headCommit: (headResult.stdout || "unknown").trim() || "unknown",
    upstreamCommit: (upstreamCommitResult.stdout || "unknown").trim() || "unknown",
    remoteCommits,
    remoteEntries,
    stagedEntries,
    reconciliation: {
      exists: reconciliationReport.exists,
      status: reconciliationStatus || "missing",
      unresolvedOverlaps,
      ok: reconciliationOk,
    },
    simulation,
    blockers,
    holds,
  };
}

async function simulateStagedOverlayOnUpstream({ upstream, stagedEntries, stagedIndexListing }) {
  const tmpRoot = await mkdtemp(join(tmpdir(), "commercial-owner-merge-"));
  const tempIndexPath = join(tmpRoot, "index");

  try {
    const readTreeResult = await runQuietCommand("git", ["read-tree", upstream], {
      env: { GIT_INDEX_FILE: tempIndexPath },
    });
    if (readTreeResult.code !== 0) {
      return {
        ok: false,
        temporaryTree: "",
        overlayEntries: [],
        error: readTreeResult.stderr || readTreeResult.stdout || "git read-tree failed.",
      };
    }

    const stagedRecordByPath = parseStagedIndexListing(stagedIndexListing);
    const overlayEntries = [];

    for (const entry of stagedEntries) {
      if (entry.status.startsWith("D")) {
        const removeResult = await runQuietCommand("git", ["update-index", "--remove", "--", entry.path], {
          env: { GIT_INDEX_FILE: tempIndexPath },
        });
        if (removeResult.code !== 0) {
          return {
            ok: false,
            temporaryTree: "",
            overlayEntries,
            error: removeResult.stderr || removeResult.stdout || `git update-index --remove failed for ${entry.path}.`,
          };
        }
        overlayEntries.push({ ...entry, action: "remove" });
        continue;
      }

      const stagedRecord = stagedRecordByPath.get(entry.path);
      if (!stagedRecord) {
        return {
          ok: false,
          temporaryTree: "",
          overlayEntries,
          error: `Missing staged object record for ${entry.path}.`,
        };
      }

      const updateResult = await runQuietCommand(
        "git",
        ["update-index", "--add", "--cacheinfo", stagedRecord.mode, stagedRecord.object, entry.path],
        { env: { GIT_INDEX_FILE: tempIndexPath } },
      );
      if (updateResult.code !== 0) {
        return {
          ok: false,
          temporaryTree: "",
          overlayEntries,
          error: updateResult.stderr || updateResult.stdout || `git update-index --cacheinfo failed for ${entry.path}.`,
        };
      }
      overlayEntries.push({ ...entry, action: "overlay" });
    }

    const writeTreeResult = await runQuietCommand("git", ["write-tree"], {
      env: { GIT_INDEX_FILE: tempIndexPath },
    });
    if (writeTreeResult.code !== 0) {
      return {
        ok: false,
        temporaryTree: "",
        overlayEntries,
        error: writeTreeResult.stderr || writeTreeResult.stdout || "git write-tree failed.",
      };
    }

    return {
      ok: true,
      temporaryTree: writeTreeResult.stdout.trim(),
      overlayEntries,
      error: "",
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

function parseNameStatusZ(output) {
  const tokens = output.split("\0").filter(Boolean);
  const entries = [];

  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++] || "";
    if (status.startsWith("R") || status.startsWith("C")) {
      const from = tokens[index++] || "";
      const to = tokens[index++] || "";
      entries.push({ status, path: normalizeStatusPath(to), from: normalizeStatusPath(from) });
      continue;
    }
    const path = tokens[index++] || "";
    entries.push({ status, path: normalizeStatusPath(path) });
  }

  return entries.filter((entry) => entry.path);
}

function parseNameStatusLine(line) {
  const parts = line.split("\t");
  return {
    status: parts[0] || "",
    path: normalizeStatusPath(parts.at(-1) || ""),
  };
}

function parseStagedIndexListing(output) {
  const records = new Map();
  for (const line of output.split("\n").filter(Boolean)) {
    const match = line.match(/^(\d+)\s+([0-9a-f]+)\s+(\d+)\t(.+)$/);
    if (!match) continue;
    const [, mode, object, stage, path] = match;
    if (stage !== "0") continue;
    records.set(normalizeStatusPath(path), { mode, object, path: normalizeStatusPath(path) });
  }
  return records;
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

function readLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  return line?.slice(prefix.length).trim() || "";
}

function readNumberLine(content, prefix) {
  const line = content.split("\n").find((entry) => entry.startsWith(prefix));
  const value = Number.parseInt(line?.slice(prefix.length).trim() || "", 10);
  return Number.isFinite(value) ? value : Number.NaN;
}

async function writeOwnerMergeReadinessReport({ reportPath, readiness }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Owner Merge Readiness Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
    "Temporary index simulation: `git read-tree <upstream>` + `git update-index --cacheinfo` + `git write-tree`",
    `Branch: ${readiness.branchLine}`,
    `Upstream: ${readiness.upstream}`,
    `Status: ${readiness.status}`,
    "",
    "This is a local, read-only owner merge-readiness artifact. It uses a temporary Git index to overlay the current staged packet on the upstream tree, then deletes that temp index. It does not fetch, pull, rebase, merge, stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Merge Simulation Summary",
    "",
    `Local HEAD: ${readiness.headCommit}`,
    `Upstream commit: ${readiness.upstreamCommit}`,
    `Remote commits: ${readiness.remoteCommits.length}`,
    `Remote changed files: ${readiness.remoteEntries.length}`,
    `Staged entries: ${readiness.stagedEntries.length}`,
    `Upstream reconciliation status: ${readiness.reconciliation.status}`,
    `Unresolved upstream overlaps: ${Number.isFinite(readiness.reconciliation.unresolvedOverlaps) ? readiness.reconciliation.unresolvedOverlaps : "unknown"}`,
    `Merge simulation: ${readiness.simulation.ok ? "PASS" : "FAIL"}`,
    `Temporary merged tree: ${readiness.simulation.temporaryTree || "not written"}`,
    `Overlay entries: ${readiness.simulation.overlayEntries.length}`,
    "",
    "## Readiness Checks",
    "",
    "| Status | Check | Evidence | Next action |",
    "| --- | --- | --- | --- |",
    `| ${readiness.upstream === "missing" ? "BLOCKED" : "PASS"} | Upstream branch | ${escapeMarkdownTable(readiness.upstream)} | ${readiness.upstream === "missing" ? "Configure or select an upstream branch before owner merge." : "Use this upstream for owner-controlled branch freshness."} |`,
    `| ${readiness.reconciliation.ok ? "PASS" : readiness.reconciliation.exists ? "BLOCKED" : "HOLD"} | Upstream reconciliation | Status ${escapeMarkdownTable(readiness.reconciliation.status)} with ${Number.isFinite(readiness.reconciliation.unresolvedOverlaps) ? readiness.reconciliation.unresolvedOverlaps : "unknown"} unresolved overlap(s). | ${readiness.reconciliation.ok ? "Keep reconciliation report with the staged packet." : "Run npm run check:commercial-upstream-reconciliation:write and resolve unresolved overlap."} |`,
    `| ${readiness.simulation.ok ? "PASS" : "BLOCKED"} | Staged packet overlay on upstream | ${readiness.simulation.ok ? `Temporary tree ${readiness.simulation.temporaryTree} was written from upstream plus staged packet.` : escapeMarkdownTable(readiness.simulation.error)} | ${readiness.simulation.ok ? "Release owner can preserve this staged packet after branch freshness work." : "Do not merge/push/deploy until the overlay failure is resolved."} |`,
    `| ${readiness.remoteCommits.length ? "HOLD" : "PASS"} | Owner merge/rebase still required | ${readiness.remoteCommits.length} upstream commit(s) visible. | ${readiness.remoteCommits.length ? "Release owner still performs the actual merge/rebase and reruns npm run check:commercial-release." : "No upstream-only commit is visible."} |`,
    "",
    "## Remote Commits",
    "",
    ...remoteCommitLines(readiness),
    "",
    "## Remote Changed Files",
    "",
    ...remoteFileLines(readiness),
    "",
    "## Required Owner Actions",
    "",
    ...requiredOwnerActionLines(readiness),
    "",
    "## Operator Commands",
    "",
    "```sh",
    "npm run check:commercial-owner-merge-readiness:write",
    "npm run check:commercial-owner-merge-readiness-report",
    "git log --oneline HEAD..origin/ui-cleanup",
    "git diff --name-status HEAD..origin/ui-cleanup",
    "npm run check:commercial-release",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial owner merge-readiness report: ${reportPath}`);
}

function remoteCommitLines(readiness) {
  if (!readiness.remoteCommits.length) {
    return ["- No upstream-only commits are visible from the current local refs."];
  }
  return readiness.remoteCommits.map((line) => `- ${line}`);
}

function remoteFileLines(readiness) {
  if (!readiness.remoteEntries.length) {
    return ["- No upstream-only changed files are visible from the current local refs."];
  }
  return readiness.remoteEntries.map((entry) => `- ${entry.status} \`${entry.path}\``);
}

function requiredOwnerActionLines(readiness) {
  if (readiness.blockers.length || readiness.holds.length) {
    return [
      ...readiness.blockers.map((item) => `- BLOCKED: ${item}`),
      ...readiness.holds.map((item) => `- HOLD: ${item}`),
      "- The release owner still needs to perform the actual branch freshness step.",
      "- Rerun `npm run check:commercial-release` after the branch is fresh.",
    ];
  }
  return ["- No owner merge-readiness HOLD or BLOCKED state is visible from the current local refs."];
}

async function verifyOwnerMergeReadinessReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Owner Merge Readiness Report",
    "This is a local, read-only owner merge-readiness artifact.",
    "Temporary index simulation: `git read-tree <upstream>` + `git update-index --cacheinfo` + `git write-tree`",
    "## Merge Simulation Summary",
    "Remote commits:",
    "Remote changed files:",
    "Staged entries:",
    "Upstream reconciliation status:",
    "Unresolved upstream overlaps:",
    "Merge simulation:",
    "Temporary merged tree:",
    "Overlay entries:",
    "## Readiness Checks",
    "Staged packet overlay on upstream",
    "Owner merge/rebase still required",
    "## Remote Commits",
    "## Required Owner Actions",
    "## Operator Commands",
    "npm run check:commercial-owner-merge-readiness:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing owner merge-readiness report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Owner merge-readiness report is missing a valid Status.");
  }

  if (content.includes("| BLOCKED |")) {
    problems.push("Owner merge-readiness report contains a BLOCKED check row.");
  }

  if (!content.includes("Merge simulation: PASS")) {
    problems.push("Owner merge-readiness report does not show Merge simulation: PASS.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Owner merge-readiness report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial owner merge-readiness report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial owner merge-readiness report check passed: ${path}`);
}

function printSummary(readiness) {
  console.log(`Branch: ${readiness.branchLine}`);
  console.log(`Upstream: ${readiness.upstream}`);
  console.log(`Status: ${readiness.status}`);
  console.log(`Remote commits: ${readiness.remoteCommits.length}`);
  console.log(`Staged entries: ${readiness.stagedEntries.length}`);
  console.log(`Merge simulation: ${readiness.simulation.ok ? "PASS" : "FAIL"}`);
  if (readiness.simulation.temporaryTree) {
    console.log(`Temporary merged tree: ${readiness.simulation.temporaryTree}`);
  }
}

function runQuietCommand(command, commandArgs, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(options.env || {}),
      },
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
