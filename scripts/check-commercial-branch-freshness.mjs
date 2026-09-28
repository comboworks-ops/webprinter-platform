#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial branch freshness report.

Usage:
  node scripts/check-commercial-branch-freshness.mjs
  node scripts/check-commercial-branch-freshness.mjs --write-report
  node scripts/check-commercial-branch-freshness.mjs --verify-report

Options:
  --write-report   Write a local markdown branch freshness report.
  --verify-report  Verify the local markdown branch freshness report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyBranchFreshnessReport(reportPath);
  process.exit(0);
}

const branchFreshness = await buildBranchFreshness();

if (writeReport) {
  await writeBranchFreshnessReport({ reportPath, branchFreshness });
  if (verifyReport) {
    await verifyBranchFreshnessReport(reportPath);
  }
} else {
  printSummary(branchFreshness);
}

console.log(`Commercial branch freshness report check completed: ${branchFreshness.status}.`);

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

async function buildBranchFreshness() {
  const [statusResult, upstreamResult, stagedResult, headResult] = await Promise.all([
    runQuietCommand("git", ["status", "--short", "--branch"]),
    runQuietCommand("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]),
    runQuietCommand("git", ["diff", "--cached", "--name-status"]),
    runQuietCommand("git", ["rev-parse", "--short", "HEAD"]),
  ]);

  const statusLines = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = statusLines.find((line) => line.startsWith("##")) || "unknown";
  const upstream = upstreamResult.code === 0 ? upstreamResult.stdout.trim() : "";
  const stagedEntries = stagedResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseNameStatusEntry);

  if (!upstream) {
    return {
      status: "HOLD",
      branchLine,
      upstream: "missing",
      headCommit: (headResult.stdout || "unknown").trim() || "unknown",
      remoteCommits: [],
      remoteEntries: [],
      stagedEntries,
      overlapEntries: [],
      behindCount: parseBehindCount(branchLine),
      aheadCount: parseAheadCount(branchLine),
      problems: ["No configured upstream branch was found."],
    };
  }

  const [commitResult, remoteDiffResult] = await Promise.all([
    runQuietCommand("git", ["log", "--oneline", `HEAD..${upstream}`]),
    runQuietCommand("git", ["diff", "--name-status", `HEAD..${upstream}`]),
  ]);

  const remoteCommits = commitResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const remoteEntries = remoteDiffResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map(parseNameStatusEntry);
  const stagedPathSet = new Set(stagedEntries.map((entry) => entry.path));
  const overlapEntries = remoteEntries.filter((entry) => stagedPathSet.has(entry.path));
  const behindCount = parseBehindCount(branchLine) || remoteCommits.length;
  const aheadCount = parseAheadCount(branchLine);
  const problems = [];

  if (behindCount > 0) {
    problems.push(`${behindCount} upstream commit(s) are not in local HEAD.`);
  }
  if (overlapEntries.length > 0) {
    problems.push(`${overlapEntries.length} remote changed file(s) overlap with the staged packet.`);
  }

  return {
    status: problems.length ? "HOLD" : "READY",
    branchLine,
    upstream,
    headCommit: (headResult.stdout || "unknown").trim() || "unknown",
    remoteCommits,
    remoteEntries,
    stagedEntries,
    overlapEntries,
    behindCount,
    aheadCount,
    problems,
  };
}

function parseNameStatusEntry(line) {
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

function parseBehindCount(branchLine) {
  const match = String(branchLine || "").match(/behind (\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseAheadCount(branchLine) {
  const match = String(branchLine || "").match(/ahead (\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function writeBranchFreshnessReport({ reportPath, branchFreshness }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Branch Freshness Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
    `Branch: ${branchFreshness.branchLine}`,
    `Upstream: ${branchFreshness.upstream}`,
    `Status: ${branchFreshness.status}`,
    "",
    "This is a local, read-only branch freshness artifact. It does not fetch, pull, rebase, merge, stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Remote Delta Summary",
    "",
    `Local HEAD: ${branchFreshness.headCommit}`,
    `Behind count: ${branchFreshness.behindCount}`,
    `Ahead count: ${branchFreshness.aheadCount}`,
    `Remote commits: ${branchFreshness.remoteCommits.length}`,
    `Remote changed files: ${branchFreshness.remoteEntries.length}`,
    `Staged packet files: ${branchFreshness.stagedEntries.length}`,
    `Overlaps with staged packet: ${branchFreshness.overlapEntries.length}`,
    "",
    "## Remote Commits",
    "",
    ...remoteCommitLines(branchFreshness),
    "",
    "## Remote Files",
    "",
    "| Status | Path | Staged overlap |",
    "| --- | --- | --- |",
    ...remoteFileRows(branchFreshness),
    "",
    "## Staged Overlap",
    "",
    "| Status | Path | Review reason |",
    "| --- | --- | --- |",
    ...stagedOverlapRows(branchFreshness),
    "",
    "## Required Owner Review",
    "",
    ...requiredOwnerReviewLines(branchFreshness),
    "",
    "## Operator Commands",
    "",
    "```sh",
    "git fetch --prune origin",
    `git log --oneline HEAD..${branchFreshness.upstream}`,
    `git diff --name-status HEAD..${branchFreshness.upstream}`,
    "npm run check:commercial-branch-freshness:write",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial branch freshness report: ${reportPath}`);
}

function remoteCommitLines(branchFreshness) {
  if (!branchFreshness.remoteCommits.length) {
    return ["- No upstream-only commits are visible from the current local refs."];
  }
  return branchFreshness.remoteCommits.map((line) => `- ${line}`);
}

function remoteFileRows(branchFreshness) {
  if (!branchFreshness.remoteEntries.length) {
    return ["| clean | `none` | no |"];
  }
  const overlapPathSet = new Set(branchFreshness.overlapEntries.map((entry) => entry.path));
  return branchFreshness.remoteEntries.map((entry) => (
    `| ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${overlapPathSet.has(entry.path) ? "yes" : "no"} |`
  ));
}

function stagedOverlapRows(branchFreshness) {
  if (!branchFreshness.overlapEntries.length) {
    return ["| none | `none` | No remote-changed files overlap the staged packet. |"];
  }
  return branchFreshness.overlapEntries.map((entry) => (
    `| ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | Review remote change before commit/push/deploy because this file is also staged locally. |`
  ));
}

function requiredOwnerReviewLines(branchFreshness) {
  if (!branchFreshness.problems.length) {
    return ["- No branch freshness HOLD is visible from the current local refs."];
  }
  return [
    ...branchFreshness.problems.map((problem) => `- ${problem}`),
    "- Do not push or deploy until the upstream commit is reviewed and merged/rebased by the release owner.",
    "- If the overlap is intentional, rerun the commercial release gate after the branch is made fresh.",
  ];
}

async function verifyBranchFreshnessReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Branch Freshness Report",
    "This is a local, read-only branch freshness artifact.",
    "Git status command: `git status --short --branch`",
    "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
    "## Remote Delta Summary",
    "Remote commits:",
    "Remote changed files:",
    "Overlaps with staged packet:",
    "## Remote Commits",
    "## Remote Files",
    "## Staged Overlap",
    "## Required Owner Review",
    "## Operator Commands",
    "npm run check:commercial-branch-freshness:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing branch-freshness report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD"].includes(status || "")) {
    problems.push("Branch-freshness report is missing a valid Status.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Branch-freshness report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial branch freshness report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial branch freshness report check passed: ${path}`);
}

function printSummary(branchFreshness) {
  console.log(`Branch: ${branchFreshness.branchLine}`);
  console.log(`Upstream: ${branchFreshness.upstream}`);
  console.log(`Status: ${branchFreshness.status}`);
  console.log(`Remote commits: ${branchFreshness.remoteCommits.length}`);
  console.log(`Remote changed files: ${branchFreshness.remoteEntries.length}`);
  console.log(`Overlaps with staged packet: ${branchFreshness.overlapEntries.length}`);
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
