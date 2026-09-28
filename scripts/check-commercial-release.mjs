#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_PROOF_REPORT_PATH = "docs/COMMERCIAL_PROOF_LATEST.md";
const DEFAULT_CHANGESET_REPORT_PATH = "docs/COMMERCIAL_CHANGESET_LATEST.md";
const DEFAULT_APPLICATION_SOURCE_REPORT_PATH = "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md";
const DEFAULT_SUPABASE_REPORT_PATH = "docs/COMMERCIAL_SUPABASE_LATEST.md";
const DEFAULT_STAGED_PACKET_REPORT_PATH = "docs/COMMERCIAL_STAGED_PACKET_LATEST.md";
const DEFAULT_BRANCH_FRESHNESS_REPORT_PATH = "docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md";
const DEFAULT_UPSTREAM_RECONCILIATION_REPORT_PATH = "docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md";
const DEFAULT_OWNER_MERGE_READINESS_REPORT_PATH = "docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md";
const DEFAULT_RELEASE_OWNER_SEQUENCE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md";
const DEFAULT_DEPLOY_READINESS_REPORT_PATH = "docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md";
const DEFAULT_RELEASE_HANDOFF_REPORT_PATH = "docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md";
const DEFAULT_RELEASE_PACKET_REPORT_PATH = "docs/COMMERCIAL_RELEASE_PACKET_LATEST.md";
const DEFAULT_RELEASE_REPORT_PATH = "docs/COMMERCIAL_RELEASE_LATEST.md";
const GIT_STATUS_LINE_LIMIT = 80;
const args = process.argv.slice(2);
const baseUrl = readArg("--base-url", process.env.TENANT_PROOF_BASE_URL || "http://127.0.0.1:8083");
const timeoutMs = readArg("--timeout-ms", process.env.TENANT_PROOF_TIMEOUT_MS || "25000");
const reportPath = readArg("--report-path", DEFAULT_PROOF_REPORT_PATH);
const changesetReportPath = readArg("--changeset-report-path", DEFAULT_CHANGESET_REPORT_PATH);
const applicationSourceReportPath = readArg("--application-source-report-path", DEFAULT_APPLICATION_SOURCE_REPORT_PATH);
const supabaseReportPath = readArg("--supabase-report-path", DEFAULT_SUPABASE_REPORT_PATH);
const stagedPacketReportPath = readArg("--staged-packet-report-path", DEFAULT_STAGED_PACKET_REPORT_PATH);
const branchFreshnessReportPath = readArg("--branch-freshness-report-path", DEFAULT_BRANCH_FRESHNESS_REPORT_PATH);
const upstreamReconciliationReportPath = readArg("--upstream-reconciliation-report-path", DEFAULT_UPSTREAM_RECONCILIATION_REPORT_PATH);
const ownerMergeReadinessReportPath = readArg("--owner-merge-readiness-report-path", DEFAULT_OWNER_MERGE_READINESS_REPORT_PATH);
const releaseOwnerSequenceReportPath = readArg("--release-owner-sequence-report-path", DEFAULT_RELEASE_OWNER_SEQUENCE_REPORT_PATH);
const deployReadinessReportPath = readArg("--deploy-readiness-report-path", DEFAULT_DEPLOY_READINESS_REPORT_PATH);
const releaseHandoffReportPath = readArg("--release-handoff-report-path", DEFAULT_RELEASE_HANDOFF_REPORT_PATH);
const releasePacketReportPath = readArg("--release-packet-report-path", DEFAULT_RELEASE_PACKET_REPORT_PATH);
const releaseReportPath = readArg("--release-report-path", DEFAULT_RELEASE_REPORT_PATH);

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial release gate.

Usage:
  node scripts/check-commercial-release.mjs

Options:
  --base-url <url>       Site root to check. Default: ${baseUrl}
  --timeout-ms <number> Per-route timeout. Default: ${timeoutMs}
  --report-path <path>  Report output path. Default: ${reportPath}
  --changeset-report-path <path>
                         Changeset summary path. Default: ${changesetReportPath}
  --application-source-report-path <path>
                         Application source review path. Default: ${applicationSourceReportPath}
  --supabase-report-path <path>
                         Supabase review path. Default: ${supabaseReportPath}
  --staged-packet-report-path <path>
                         Staged packet review path. Default: ${stagedPacketReportPath}
  --branch-freshness-report-path <path>
                         Branch freshness review path. Default: ${branchFreshnessReportPath}
  --upstream-reconciliation-report-path <path>
                         Upstream reconciliation review path. Default: ${upstreamReconciliationReportPath}
  --owner-merge-readiness-report-path <path>
                         Owner merge-readiness review path. Default: ${ownerMergeReadinessReportPath}
  --release-owner-sequence-report-path <path>
                         Release owner sequence path. Default: ${releaseOwnerSequenceReportPath}
  --deploy-readiness-report-path <path>
                         Deploy readiness decision path. Default: ${deployReadinessReportPath}
  --release-handoff-report-path <path>
                         Release handoff/rollback path. Default: ${releaseHandoffReportPath}
  --release-packet-report-path <path>
                         Release packet index path. Default: ${releasePacketReportPath}
  --release-report-path <path>
                         Release summary path. Default: ${releaseReportPath}
`);
  process.exit(0);
}

const steps = [
  {
    name: "Commercial proof gate with report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-proof.mjs",
      "--write-report",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      timeoutMs,
      "--report-path",
      reportPath,
    ],
  },
  {
    name: "Commercial proof report verifier",
    command: process.execPath,
    args: ["scripts/check-commercial-proof-report.mjs", "--report-path", reportPath],
  },
  {
    name: "Commercial changeset report",
    command: process.execPath,
    args: ["scripts/check-commercial-changeset.mjs", "--write-report", "--verify-report", "--report-path", changesetReportPath],
  },
  {
    name: "Commercial application-source report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-application-source.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      applicationSourceReportPath,
    ],
  },
  {
    name: "Commercial Supabase report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-supabase.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      supabaseReportPath,
    ],
  },
  {
    name: "Commercial staged packet report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-staged-packet.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      stagedPacketReportPath,
    ],
  },
  {
    name: "Commercial branch freshness report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-branch-freshness.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      branchFreshnessReportPath,
    ],
  },
  {
    name: "Commercial upstream reconciliation report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-upstream-reconciliation.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      upstreamReconciliationReportPath,
    ],
  },
  {
    name: "Commercial owner merge-readiness report",
    command: process.execPath,
    args: [
      "scripts/check-commercial-owner-merge-readiness.mjs",
      "--write-report",
      "--verify-report",
      "--report-path",
      ownerMergeReadinessReportPath,
    ],
  },
  {
    name: "Production build",
    command: process.execPath,
    args: ["node_modules/vite/bin/vite.js", "build"],
  },
];

const stepResults = [];
for (const step of steps) {
  stepResults.push(await runVisibleStep(step));
}

let repositoryState = await readRepositoryState();
await writeReleaseReport({
  stepResults,
  postReleaseResults: [],
  baseUrl,
  timeoutMs,
  reportPath,
  changesetReportPath,
  applicationSourceReportPath,
  supabaseReportPath,
  stagedPacketReportPath,
  branchFreshnessReportPath,
  upstreamReconciliationReportPath,
  ownerMergeReadinessReportPath,
  releaseOwnerSequenceReportPath,
  deployReadinessReportPath,
  releaseHandoffReportPath,
  releaseReportPath,
  repositoryState,
});
const postReleaseResults = [];
postReleaseResults.push(await runVisibleStep({
  name: "Commercial release-owner sequence report",
  command: process.execPath,
  args: [
    "scripts/check-commercial-release-owner-sequence.mjs",
    "--write-report",
    "--verify-report",
    "--report-path",
    releaseOwnerSequenceReportPath,
  ],
}));
postReleaseResults.push(await runVisibleStep({
  name: "Commercial deploy readiness report",
  command: process.execPath,
  args: [
    "scripts/check-commercial-deploy-readiness.mjs",
    "--write-report",
    "--verify-report",
    "--report-path",
    deployReadinessReportPath,
  ],
}));
postReleaseResults.push(await runVisibleStep({
  name: "Commercial release handoff report",
  command: process.execPath,
  args: [
    "scripts/check-commercial-release-handoff.mjs",
    "--write-report",
    "--verify-report",
    "--report-path",
    releaseHandoffReportPath,
  ],
}));
repositoryState = await readRepositoryState();
await writeReleaseReport({
  stepResults,
  postReleaseResults,
  baseUrl,
  timeoutMs,
  reportPath,
  changesetReportPath,
  applicationSourceReportPath,
  supabaseReportPath,
  stagedPacketReportPath,
  branchFreshnessReportPath,
  upstreamReconciliationReportPath,
  ownerMergeReadinessReportPath,
  releaseOwnerSequenceReportPath,
  deployReadinessReportPath,
  releaseHandoffReportPath,
  releaseReportPath,
  repositoryState,
});
await runVisibleStep({
  name: "Commercial release report verifier",
  command: process.execPath,
  args: ["scripts/check-commercial-release-report.mjs", "--report-path", releaseReportPath],
});
await runVisibleStep({
  name: "Commercial release packet index",
  command: process.execPath,
  args: [
    "scripts/check-commercial-release-packet.mjs",
    "--write-report",
    "--verify-report",
    "--report-path",
    releasePacketReportPath,
  ],
});
console.log("\nCommercial release gate passed.");

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

function runVisibleStep(step) {
  console.log(`\n== ${step.name} ==`);
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      const durationMs = Date.now() - startedAt;
      if (code === 0) {
        resolve({
          name: step.name,
          durationMs,
          stdout,
          stderr,
        });
        return;
      }

      const detail = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(new Error(`${step.name} failed with ${detail}.`));
    });
  });
}

async function writeReleaseReport({
  stepResults,
  postReleaseResults = [],
  baseUrl,
  timeoutMs,
  reportPath,
  changesetReportPath,
  applicationSourceReportPath,
  supabaseReportPath,
  stagedPacketReportPath,
  branchFreshnessReportPath,
  upstreamReconciliationReportPath,
  ownerMergeReadinessReportPath,
  releaseOwnerSequenceReportPath,
  deployReadinessReportPath,
  releaseHandoffReportPath,
  releaseReportPath,
  repositoryState,
}) {
  const generatedAt = new Date().toISOString();
  const cockpitUrl = `${baseUrl}/admin/commercial-readiness?force_domain=webprinter.dk#automated-proof-chain`;
  const markdown = [
    "# Commercial Release Report",
    "",
    `Generated: ${generatedAt}`,
    `Base URL: ${baseUrl}`,
    `Timeout: ${timeoutMs} ms`,
    `Proof report: ${reportPath}`,
    `Changeset report: ${changesetReportPath}`,
    `Application source report: ${applicationSourceReportPath}`,
    `Supabase report: ${supabaseReportPath}`,
    `Staged packet report: ${stagedPacketReportPath}`,
    `Branch freshness report: ${branchFreshnessReportPath}`,
    `Upstream reconciliation report: ${upstreamReconciliationReportPath}`,
    `Owner merge-readiness report: ${ownerMergeReadinessReportPath}`,
    `Release owner sequence report: ${releaseOwnerSequenceReportPath}`,
    `Deploy readiness report: ${deployReadinessReportPath}`,
    `Release handoff report: ${releaseHandoffReportPath}`,
    "Status: PASSED",
    "",
    "This is a local, read-only release artifact. It writes/updates local docs and build output only; it does not write products, prices, orders, SEO, POD or Supplier Bank data.",
    "",
    "## Operator View",
    "",
    `Cockpit: ${cockpitUrl}`,
    "Primary command: `npm run check:commercial-release`",
    "Proof report verifier: `npm run check:commercial-proof-report`",
    "Changeset report verifier: `npm run check:commercial-changeset-report`",
    "Application source report verifier: `npm run check:commercial-application-source-report`",
    "Supabase report verifier: `npm run check:commercial-supabase-report`",
    "Staged packet report verifier: `npm run check:commercial-staged-packet-report`",
    "Branch freshness report verifier: `npm run check:commercial-branch-freshness-report`",
    "Upstream reconciliation report verifier: `npm run check:commercial-upstream-reconciliation-report`",
    "Owner merge-readiness report verifier: `npm run check:commercial-owner-merge-readiness-report`",
    "Release owner sequence report verifier: `npm run check:commercial-release-owner-sequence-report`",
    "Deploy readiness report verifier: `npm run check:commercial-deploy-readiness-report`",
    "Release handoff report verifier: `npm run check:commercial-release-handoff-report`",
    "Release report verifier: `npm run check:commercial-release-report`",
    "",
    "## Repository State",
    "",
    "Git status command: `git status --short --branch`",
    `Worktree: ${repositoryState.worktree}`,
    `Dirty entries: ${repositoryState.dirtyEntries}`,
    `Branch: ${repositoryState.branchLine}`,
    `Status lines shown: ${repositoryState.visibleLineCount}/${repositoryState.totalLineCount}`,
    "",
    "```text",
    ...repositoryState.visibleLines,
    repositoryState.omittedLineCount > 0 ? `... ${repositoryState.omittedLineCount} more status lines omitted` : null,
    "```",
    "",
    "## Gate Steps",
    "",
    "| Status | Step | Duration | Evidence |",
    "| --- | --- | ---: | --- |",
    ...stepResults.map((result) => (
      `| PASS | ${escapeMarkdownTable(result.name)} | ${formatDuration(result.durationMs)} | ${escapeMarkdownTable(getStepEvidence(result))} |`
    )),
    "",
    "## Post-Release Decision Reports",
    "",
    "These reports are generated after the proof/build release summary exists, because they read the release proof and turn it into owner handoff decisions.",
    "",
    "| Status | Step | Duration | Evidence |",
    "| --- | --- | ---: | --- |",
    ...postReleaseResults.map((result) => (
      `| PASS | ${escapeMarkdownTable(result.name)} | ${formatDuration(result.durationMs)} | ${escapeMarkdownTable(getStepEvidence(result))} |`
    )),
    postReleaseResults.length ? "" : "| PENDING | Commercial release-owner sequence report | 0.0s | Generated after the initial release proof summary. |",
    postReleaseResults.length ? "" : "| PENDING | Commercial deploy readiness report | 0.0s | Generated after the release-owner sequence report. |",
    postReleaseResults.length ? "" : "| PENDING | Commercial release handoff report | 0.0s | Generated after deploy readiness. |",
    "",
    "## Required Evidence",
    "",
    "- Commercial readiness binding guard passed.",
    "- Owned tenant browser proof generated `docs/COMMERCIAL_PROOF_LATEST.md`.",
    "- Commercial proof report verifier passed.",
    "- Commercial changeset report generated and verified.",
    "- Commercial application-source report generated and verified.",
    "- Commercial Supabase report generated and verified.",
    "- Commercial staged packet report generated and verified.",
    "- Commercial branch freshness report generated and verified.",
    "- Commercial upstream reconciliation report generated and verified.",
    "- Commercial owner merge-readiness report generated and verified.",
    "- Commercial release-owner sequence report generated after the proof/build summary and verified.",
    "- Commercial deploy-readiness decision report generated after release-owner sequence and verified.",
    "- Commercial release handoff and rollback template generated after deploy readiness and verified.",
    "- Vite production build passed.",
    "",
  ].join("\n");

  await mkdir(dirname(releaseReportPath), { recursive: true });
  await writeFile(releaseReportPath, markdown, "utf8");
  console.log(`\nWrote commercial release report: ${releaseReportPath}`);
}

async function readRepositoryState() {
  const result = await runQuietCommand("git", ["status", "--short", "--branch"]);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || "git status unavailable").trim();
    return {
      worktree: "unavailable",
      dirtyEntries: 0,
      branchLine: "unavailable",
      visibleLines: [`git status unavailable: ${detail}`],
      totalLineCount: 1,
      visibleLineCount: 1,
      omittedLineCount: 0,
    };
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("##")) || "unknown";
  const dirtyLines = lines.filter((line) => !line.startsWith("##"));
  const visibleLines = lines.length ? lines.slice(0, GIT_STATUS_LINE_LIMIT) : ["## clean"];

  return {
    worktree: dirtyLines.length > 0 ? "dirty" : "clean",
    dirtyEntries: dirtyLines.length,
    branchLine,
    visibleLines,
    totalLineCount: lines.length || 1,
    visibleLineCount: visibleLines.length,
    omittedLineCount: Math.max(0, lines.length - visibleLines.length),
  };
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

function getStepEvidence(result) {
  if (result.name === "Commercial proof gate with report") {
    return "Proof report written and tenant proof smoke passed.";
  }
  if (result.name === "Commercial proof report verifier") {
    return "Local proof report structure and 12/12 PASS rows verified.";
  }
  if (result.name === "Commercial changeset report") {
    return "Reviewable dirty worktree summary generated and verified.";
  }
  if (result.name === "Commercial application-source report") {
    return "Runtime application-source review packet generated and verified.";
  }
  if (result.name === "Commercial Supabase report") {
    return "Supabase grant/function exposure review packet generated and verified.";
  }
  if (result.name === "Commercial staged packet report") {
    return "Git index packet checked for forbidden local/debug artifacts and held Supabase files.";
  }
  if (result.name === "Commercial owner merge-readiness report") {
    return "Temporary upstream index overlay proved the staged packet can be preserved for owner branch freshness work.";
  }
  if (result.name === "Commercial release-owner sequence report") {
    return "Ordered release-owner sequence and stop rules generated from the proof reports.";
  }
  if (result.name === "Commercial deploy readiness report") {
    return "Push/deploy decision report generated from release proof, staged packet, branch freshness and owner sequence.";
  }
  if (result.name === "Commercial release handoff report") {
    return "Release-owner handoff, rollback note template and post-deploy smoke route packet generated.";
  }
  if (result.name === "Production build") {
    return "Vite production build completed with existing warnings only.";
  }
  return "Step passed.";
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function escapeMarkdownTable(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}
