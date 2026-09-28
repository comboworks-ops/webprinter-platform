#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_RELEASE_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial release report verifier.

Usage:
  node scripts/check-commercial-release-report.mjs
  node scripts/check-commercial-release-report.mjs --report-path docs/COMMERCIAL_RELEASE_LATEST.md

Options:
  --report-path <path>  Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

const content = await readFile(reportPath, "utf8");
const problems = [];
const requiredMarkers = [
  "# Commercial Release Report",
  "Status: PASSED",
  "This is a local, read-only release artifact.",
  "it does not write products, prices, orders, SEO, POD or Supplier Bank data.",
  "Changeset report: docs/COMMERCIAL_CHANGESET_LATEST.md",
  "Application source report: docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md",
  "Supabase report: docs/COMMERCIAL_SUPABASE_LATEST.md",
  "Staged packet report: docs/COMMERCIAL_STAGED_PACKET_LATEST.md",
  "Branch freshness report: docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md",
  "Upstream reconciliation report: docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md",
  "Owner merge-readiness report: docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md",
  "Release owner sequence report: docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md",
  "Deploy readiness report: docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md",
  "Release handoff report: docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md",
  "## Operator View",
  "/admin/commercial-readiness?force_domain=webprinter.dk#automated-proof-chain",
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
  "## Repository State",
  "Git status command: `git status --short --branch`",
  "Worktree:",
  "Dirty entries:",
  "Branch:",
  "Status lines shown:",
  "## Gate Steps",
  "## Post-Release Decision Reports",
  "These reports are generated after the proof/build release summary exists",
  "## Required Evidence",
  "Commercial readiness binding guard passed.",
  "Owned tenant browser proof generated `docs/COMMERCIAL_PROOF_LATEST.md`.",
  "Commercial proof report verifier passed.",
  "Commercial changeset report generated and verified.",
  "Commercial application-source report generated and verified.",
  "Commercial Supabase report generated and verified.",
  "Commercial staged packet report generated and verified.",
  "Commercial branch freshness report generated and verified.",
  "Commercial upstream reconciliation report generated and verified.",
  "Commercial owner merge-readiness report generated and verified.",
  "Commercial release-owner sequence report generated after the proof/build summary and verified.",
  "Commercial deploy-readiness decision report generated after release-owner sequence and verified.",
  "Commercial release handoff and rollback template generated after deploy readiness and verified.",
  "Vite production build passed.",
];
const requiredSteps = [
  "Commercial proof gate with report",
  "Commercial proof report verifier",
  "Commercial changeset report",
  "Commercial application-source report",
  "Commercial Supabase report",
  "Commercial staged packet report",
  "Commercial branch freshness report",
  "Commercial upstream reconciliation report",
  "Commercial owner merge-readiness report",
  "Production build",
];
const requiredPostSteps = [
  "Commercial release-owner sequence report",
  "Commercial deploy readiness report",
  "Commercial release handoff report",
];

for (const marker of requiredMarkers) {
  if (!content.includes(marker)) {
    problems.push(`Missing release report marker: ${marker}`);
  }
}

for (const stepName of requiredSteps) {
  if (!content.includes(`| PASS | ${stepName} |`)) {
    problems.push(`Missing passing release step: ${stepName}`);
  }
}

for (const stepName of requiredPostSteps) {
  if (!content.includes(`| PASS | ${stepName} |`)) {
    problems.push(`Missing passing post-release report step: ${stepName}`);
  }
}

const passRows = content.match(/\| PASS \|/g)?.length || 0;
const requiredPassRows = requiredSteps.length + requiredPostSteps.length;
if (passRows !== requiredPassRows) {
  problems.push(`Expected ${requiredPassRows} PASS rows, found ${passRows}.`);
}

const dirtyEntriesLine = content.split("\n").find((line) => line.startsWith("Dirty entries: "));
const dirtyEntries = Number.parseInt(dirtyEntriesLine?.slice("Dirty entries: ".length).trim() || "", 10);
if (!Number.isInteger(dirtyEntries) || dirtyEntries < 0) {
  problems.push("Release report is missing a valid Dirty entries count.");
}

if (content.includes("| FAIL |")) {
  problems.push("Release report contains a failing step row.");
}

const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
const generatedAt = generatedLine?.slice("Generated: ".length).trim();
if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
  problems.push("Release report is missing a parseable Generated timestamp.");
}

if (problems.length) {
  console.error(`Commercial release report check failed for ${reportPath}:`);
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Commercial release report check passed: ${reportPath}`);

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
