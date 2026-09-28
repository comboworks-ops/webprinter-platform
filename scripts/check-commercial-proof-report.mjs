#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_PROOF_LATEST.md";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial proof report verifier.

Usage:
  node scripts/check-commercial-proof-report.mjs
  node scripts/check-commercial-proof-report.mjs --report-path docs/COMMERCIAL_PROOF_LATEST.md

Options:
  --report-path <path>  Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

const content = await readFile(reportPath, "utf8");
const problems = [];

const requiredMarkers = [
  "# Commercial Proof Report",
  "Status: 12/12 tenant proof checks passed",
  "This is a local, read-only proof artifact. It does not write products, prices, orders, SEO, POD or Supplier Bank data.",
  "Commercial readiness binding and proof alignment check passed.",
  "## Tenant Proof Checks",
  "## Covered Proof Paths",
  "Webprinter Aluminium order/upload handoff.",
  "Banner Builder Pro site package preview.",
  "Salgsmapper category landing drilldown.",
  "Salgsmapper PDF template download and designer handoff.",
  "Onlinetryksager category landing drilldown.",
  "Onlinetryksager Flyers order/upload handoff.",
];
const requiredChecks = [
  "Salgsmapper PDF template",
  "Webprinter home",
  "Webprinter aluminium",
  "Banner Builder Pro site package preview",
  "Salgsmapper home",
  "Salgsmapper category landing",
  "Salgsmapper standard folder",
  "Salgsmapper laminated folder",
  "Onlinetryksager home",
  "Onlinetryksager category landing",
  "Onlinetryksager flyer",
  "Onlinetryksager poster",
];

for (const marker of requiredMarkers) {
  if (!content.includes(marker)) {
    problems.push(`Missing report marker: ${marker}`);
  }
}

for (const checkName of requiredChecks) {
  if (!content.includes(`| PASS | ${checkName} |`)) {
    problems.push(`Missing passing proof row: ${checkName}`);
  }
}

const passRows = content.match(/\| PASS \|/g)?.length || 0;
if (passRows !== requiredChecks.length) {
  problems.push(`Expected ${requiredChecks.length} PASS rows, found ${passRows}.`);
}

if (content.includes("| FAIL |")) {
  problems.push("Report contains a failing proof row.");
}

const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
const generatedAt = generatedLine?.slice("Generated: ".length).trim();
if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
  problems.push("Report is missing a parseable Generated timestamp.");
}

if (problems.length) {
  console.error(`Commercial proof report check failed for ${reportPath}:`);
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log(`Commercial proof report check passed: ${reportPath}`);

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
