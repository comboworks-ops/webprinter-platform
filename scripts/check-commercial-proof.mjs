#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_PROOF_LATEST.md";
const args = process.argv.slice(2);
const writeReport = hasFlag("--write-report");
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const baseUrl = readArg("--base-url", process.env.TENANT_PROOF_BASE_URL || "http://127.0.0.1:8083");
const timeoutMs = readArg("--timeout-ms", process.env.TENANT_PROOF_TIMEOUT_MS || "25000");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial proof gate.

Usage:
  node scripts/check-commercial-proof.mjs
  node scripts/check-commercial-proof.mjs --write-report

Options:
  --base-url <url>       Site root to check. Default: ${baseUrl}
  --timeout-ms <number> Per-route timeout. Default: ${timeoutMs}
  --write-report        Write a local markdown report after the gate passes.
  --report-path <path>  Report output path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

const steps = [
  {
    name: "Commercial readiness binding guard",
    command: process.execPath,
    args: ["scripts/check-commercial-readiness-bindings.js"],
  },
  {
    name: "Owned-tenant browser proof",
    command: process.execPath,
    args: ["scripts/check-tenant-proof-routes.mjs", "--base-url", baseUrl, "--timeout-ms", timeoutMs],
  },
];

if (writeReport) {
  const bindingOutput = await runVisibleStep(steps[0]);
  const tenantResults = await runTenantProofJson();
  await writeProofReport({
    bindingOutput,
    tenantResults,
    reportPath,
    baseUrl,
    timeoutMs,
  });
} else {
  for (const step of steps) {
    await runVisibleStep(step);
  }
}

console.log("\nCommercial proof gate passed.");

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

async function runVisibleStep(step) {
  console.log(`\n== ${step.name} ==`);
  const result = await runStep(step);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result;
}

async function runTenantProofJson() {
  const jsonStep = {
    name: "Owned-tenant browser proof",
    command: process.execPath,
    args: [
      "scripts/check-tenant-proof-routes.mjs",
      "--base-url",
      baseUrl,
      "--timeout-ms",
      timeoutMs,
      "--json",
    ],
  };

  console.log(`\n== ${jsonStep.name} ==`);
  const result = await runStep(jsonStep);
  const tenantResults = JSON.parse(result.stdout);

  for (const route of tenantResults) {
    const status = route.ok ? "PASS" : "FAIL";
    console.log(`${status} ${route.name}: ${route.detail}`);
  }

  return tenantResults;
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
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

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const detail = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      const output = [stdout, stderr].filter(Boolean).join("\n");
      reject(new Error(`${step.name} failed with ${detail}.${output ? `\n${output}` : ""}`));
    });
  });
}

async function writeProofReport({ bindingOutput, tenantResults, reportPath, baseUrl, timeoutMs }) {
  const generatedAt = new Date().toISOString();
  const passedCount = tenantResults.filter((result) => result.ok).length;
  const totalCount = tenantResults.length;
  const markdown = [
    "# Commercial Proof Report",
    "",
    `Generated: ${generatedAt}`,
    `Base URL: ${baseUrl}`,
    `Timeout: ${timeoutMs} ms`,
    `Status: ${passedCount}/${totalCount} tenant proof checks passed`,
    "",
    "This is a local, read-only proof artifact. It does not write products, prices, orders, SEO, POD or Supplier Bank data.",
    "",
    "## Binding Guard",
    "",
    "```text",
    bindingOutput.stdout.trim() || "Commercial readiness binding guard passed.",
    "```",
    "",
    "## Tenant Proof Checks",
    "",
    "| Status | Check | Route | Evidence |",
    "| --- | --- | --- | --- |",
    ...tenantResults.map((result) => (
      `| ${result.ok ? "PASS" : "FAIL"} | ${escapeMarkdownTable(result.name)} | ${escapeMarkdownTable(result.finalUrl || result.url || "")} | ${escapeMarkdownTable(result.detail)} |`
    )),
    "",
    "## Covered Proof Paths",
    "",
    "- Webprinter Aluminium order/upload handoff.",
    "- Banner Builder Pro site package preview.",
    "- Salgsmapper category landing drilldown.",
    "- Salgsmapper PDF template download and designer handoff.",
    "- Onlinetryksager category landing drilldown.",
    "- Onlinetryksager Flyers order/upload handoff.",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`\nWrote commercial proof report: ${reportPath}`);
}

function escapeMarkdownTable(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}
