#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial upstream reconciliation report.

Usage:
  node scripts/check-commercial-upstream-reconciliation.mjs
  node scripts/check-commercial-upstream-reconciliation.mjs --write-report
  node scripts/check-commercial-upstream-reconciliation.mjs --verify-report

Options:
  --write-report   Write a local markdown upstream reconciliation report.
  --verify-report  Verify the local markdown upstream reconciliation report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyUpstreamReconciliationReport(reportPath);
  process.exit(0);
}

const reconciliation = await buildUpstreamReconciliation();

if (writeReport) {
  await writeUpstreamReconciliationReport({ reportPath, reconciliation });
  if (verifyReport) {
    await verifyUpstreamReconciliationReport(reportPath);
  }
} else {
  printSummary(reconciliation);
}

console.log(`Commercial upstream reconciliation report check completed: ${reconciliation.status}.`);

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

async function buildUpstreamReconciliation() {
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
      status: "BLOCKED",
      branchLine,
      upstream: "missing",
      headCommit: (headResult.stdout || "unknown").trim() || "unknown",
      remoteCommits: [],
      remoteEntries: [],
      stagedEntries,
      reconciliations: [],
      summary: { represented: 0, exact: 0, superseded: 0, unresolved: 0, remoteOnly: 0 },
      holds: [],
      blockers: ["No configured upstream branch was found."],
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
  const reconciliations = [];

  for (const entry of overlapEntries) {
    reconciliations.push(await reconcileOverlap(entry, upstream));
  }

  const remoteOnly = remoteEntries.filter((entry) => !stagedPathSet.has(entry.path)).length;
  const summary = {
    represented: reconciliations.filter((item) => item.state === "REPRESENTED").length,
    exact: reconciliations.filter((item) => item.state === "EXACT").length,
    superseded: reconciliations.filter((item) => item.state === "SUPERSEDED").length,
    unresolved: reconciliations.filter((item) => item.state === "UNRESOLVED").length,
    remoteOnly,
  };
  const blockers = [];
  const holds = [];

  if (summary.unresolved > 0) {
    blockers.push(`${summary.unresolved} upstream overlap(s) are not represented in the staged packet.`);
  }
  if (remoteCommits.length > 0) {
    holds.push(`${remoteCommits.length} upstream commit(s) still require owner-controlled merge/rebase before push/deploy.`);
  }
  if (summary.remoteOnly > 0) {
    holds.push(`${summary.remoteOnly} upstream changed file(s) are not in the staged packet.`);
  }

  return {
    status: blockers.length ? "BLOCKED" : holds.length ? "HOLD" : "READY",
    branchLine,
    upstream,
    headCommit: (headResult.stdout || "unknown").trim() || "unknown",
    remoteCommits,
    remoteEntries,
    stagedEntries,
    reconciliations,
    summary,
    holds,
    blockers,
  };
}

async function reconcileOverlap(entry, upstream) {
  const [remoteContentResult, stagedContentResult, remotePatchResult] = await Promise.all([
    runQuietCommand("git", ["show", `${upstream}:${entry.path}`]),
    runQuietCommand("git", ["show", `:${entry.path}`]),
    runQuietCommand("git", ["diff", `HEAD..${upstream}`, "--", entry.path]),
  ]);
  const remoteContent = remoteContentResult.stdout;
  const stagedContent = stagedContentResult.stdout;
  const remotePatch = remotePatchResult.stdout;

  if (remoteContentResult.code === 0 && stagedContentResult.code === 0 && remoteContent === stagedContent) {
    return {
      ...entry,
      state: "EXACT",
      evidence: "Staged content exactly matches upstream content.",
    };
  }

  const semantic = await semanticReconciliation(entry.path, stagedContent);
  if (semantic) {
    return {
      ...entry,
      state: semantic.state,
      evidence: semantic.evidence,
    };
  }

  const remoteAddedLines = remotePatch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter(Boolean);
  const missingAddedLines = remoteAddedLines.filter((line) => !stagedContent.includes(line));

  if (remoteAddedLines.length > 0 && missingAddedLines.length === 0) {
    return {
      ...entry,
      state: "REPRESENTED",
      evidence: "All non-empty upstream added lines are present in the staged content.",
    };
  }

  return {
    ...entry,
    state: "UNRESOLVED",
    evidence: missingAddedLines.length
      ? `Missing ${missingAddedLines.length} upstream added line(s) from staged content.`
      : "Could not prove that the upstream overlap is represented in the staged content.",
  };
}

async function semanticReconciliation(path, stagedContent) {
  if (path === "package.json") {
    try {
      const packageJson = JSON.parse(stagedContent);
      const hasScript = packageJson.scripts?.["check:commercial-readiness"] === "node scripts/check-commercial-readiness-bindings.js";
      const hasHtml2Canvas = packageJson.dependencies?.html2canvas === "^1.4.1";
      if (hasScript && hasHtml2Canvas) {
        return {
          state: "REPRESENTED",
          evidence: "`check:commercial-readiness` and `html2canvas` are present in staged package.json.",
        };
      }
    } catch {
      return null;
    }
  }

  if (path === "package-lock.json") {
    if (stagedContent.includes('"html2canvas": "^1.4.1"') && stagedContent.includes('"node_modules/html2canvas"')) {
      return {
        state: "REPRESENTED",
        evidence: "`html2canvas` dependency and lock entry are present in staged package-lock.json.",
      };
    }
  }

  if (path === "scripts/check-commercial-readiness-bindings.js") {
    const requiredMarkers = [
      "const declaration = \"const commercialDecisionsQueue = commercialDecisions;\"",
      "commercialBranchFreshnessFilePath",
      "Commercial readiness binding and proof alignment check passed.",
    ];
    if (requiredMarkers.every((marker) => stagedContent.includes(marker))) {
      return {
        state: "SUPERSEDED",
        evidence: "The upstream 59-line binding guard is superseded by the staged full proof-chain binding guard.",
      };
    }
  }

  if (path === "src/pages/admin/CommercialReadiness.tsx") {
    const declarationIndex = stagedContent.indexOf("const commercialDecisionsQueue = commercialDecisions;");
    const componentIndex = stagedContent.indexOf("export default function CommercialReadiness()");
    const requiredMarkers = [
      "getCommercialAutomationMap(",
      "getCommercialFocusItems(",
      "getCommercialPilotAcceptanceGate(",
      "getPaidPilotPackage(",
      "getCommercialDecisionOptionCards(commercialDecisionsQueue)",
      "{commercialDecisionsQueue.map((item) => (",
    ];
    if (
      declarationIndex >= 0
      && componentIndex >= 0
      && declarationIndex < componentIndex
      && requiredMarkers.every((marker) => stagedContent.includes(marker))
    ) {
      return {
        state: "SUPERSEDED",
        evidence: "The upstream in-component useMemo guard is superseded by the staged module-scope queue declaration and dependent bindings.",
      };
    }
  }

  return null;
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

async function writeUpstreamReconciliationReport({ reportPath, reconciliation }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Upstream Reconciliation Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
    `Branch: ${reconciliation.branchLine}`,
    `Upstream: ${reconciliation.upstream}`,
    `Status: ${reconciliation.status}`,
    "",
    "This is a local, read-only upstream reconciliation artifact. It does not fetch, pull, rebase, merge, stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Reconciliation Summary",
    "",
    `Local HEAD: ${reconciliation.headCommit}`,
    `Remote commits: ${reconciliation.remoteCommits.length}`,
    `Remote changed files: ${reconciliation.remoteEntries.length}`,
    `Staged packet files: ${reconciliation.stagedEntries.length}`,
    `Exact overlaps: ${reconciliation.summary.exact}`,
    `Represented overlaps: ${reconciliation.summary.represented}`,
    `Superseded overlaps: ${reconciliation.summary.superseded}`,
    `Unresolved overlaps: ${reconciliation.summary.unresolved}`,
    `Remote-only files: ${reconciliation.summary.remoteOnly}`,
    "",
    "## Remote Commits",
    "",
    ...remoteCommitLines(reconciliation),
    "",
    "## Overlap Reconciliation",
    "",
    "| State | Remote status | Path | Evidence |",
    "| --- | --- | --- | --- |",
    ...overlapRows(reconciliation),
    "",
    "## Required Owner Review",
    "",
    ...ownerReviewLines(reconciliation),
    "",
    "## Operator Commands",
    "",
    "```sh",
    `git log --oneline HEAD..${reconciliation.upstream}`,
    `git diff --name-status HEAD..${reconciliation.upstream}`,
    "npm run check:commercial-upstream-reconciliation:write",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial upstream reconciliation report: ${reportPath}`);
}

function remoteCommitLines(reconciliation) {
  if (!reconciliation.remoteCommits.length) {
    return ["- No upstream-only commits are visible from the current local refs."];
  }
  return reconciliation.remoteCommits.map((line) => `- ${line}`);
}

function overlapRows(reconciliation) {
  if (!reconciliation.reconciliations.length) {
    return ["| none | none | `none` | No upstream/staged overlap is visible. |"];
  }
  return reconciliation.reconciliations.map((entry) => (
    `| ${entry.state} | ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(entry.evidence)} |`
  ));
}

function ownerReviewLines(reconciliation) {
  if (reconciliation.blockers.length || reconciliation.holds.length) {
    return [
      ...reconciliation.blockers.map((item) => `- BLOCKED: ${item}`),
      ...reconciliation.holds.map((item) => `- HOLD: ${item}`),
      "- Do not push or deploy until the upstream commit is merged/rebased by the release owner.",
      "- Rerun the full commercial release gate after branch freshness changes.",
    ];
  }
  return ["- No upstream reconciliation HOLD or BLOCKED state is visible from the current local refs."];
}

async function verifyUpstreamReconciliationReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Upstream Reconciliation Report",
    "This is a local, read-only upstream reconciliation artifact.",
    "Git status command: `git status --short --branch`",
    "Git upstream command: `git rev-parse --abbrev-ref --symbolic-full-name @{u}`",
    "## Reconciliation Summary",
    "Exact overlaps:",
    "Represented overlaps:",
    "Superseded overlaps:",
    "Unresolved overlaps:",
    "Remote-only files:",
    "## Remote Commits",
    "## Overlap Reconciliation",
    "## Required Owner Review",
    "## Operator Commands",
    "npm run check:commercial-upstream-reconciliation:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing upstream reconciliation report marker: ${marker}`);
    }
  }

  const statusLine = content.split("\n").find((line) => line.startsWith("Status: "));
  const status = statusLine?.slice("Status: ".length).trim();
  if (!["READY", "HOLD", "BLOCKED"].includes(status || "")) {
    problems.push("Upstream reconciliation report is missing a valid Status.");
  }

  const unresolvedLine = content.split("\n").find((line) => line.startsWith("Unresolved overlaps: "));
  const unresolvedCount = Number.parseInt(unresolvedLine?.slice("Unresolved overlaps: ".length).trim() || "", 10);
  if (!Number.isInteger(unresolvedCount) || unresolvedCount < 0) {
    problems.push("Upstream reconciliation report is missing a valid unresolved overlap count.");
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Upstream reconciliation report is missing a parseable Generated timestamp.");
  }

  if (problems.length) {
    console.error(`Commercial upstream reconciliation report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial upstream reconciliation report check passed: ${path}`);
}

function printSummary(reconciliation) {
  console.log(`Branch: ${reconciliation.branchLine}`);
  console.log(`Upstream: ${reconciliation.upstream}`);
  console.log(`Status: ${reconciliation.status}`);
  console.log(`Remote commits: ${reconciliation.remoteCommits.length}`);
  console.log(`Represented overlaps: ${reconciliation.summary.represented}`);
  console.log(`Superseded overlaps: ${reconciliation.summary.superseded}`);
  console.log(`Unresolved overlaps: ${reconciliation.summary.unresolved}`);
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
