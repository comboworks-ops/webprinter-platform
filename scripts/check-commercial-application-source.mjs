#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md";
const FILES_PER_GROUP_LIMIT = 40;
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial application-source review report.

Usage:
  node scripts/check-commercial-application-source.mjs
  node scripts/check-commercial-application-source.mjs --write-report
  node scripts/check-commercial-application-source.mjs --verify-report

Options:
  --write-report   Write a local markdown application-source report.
  --verify-report  Verify the local markdown application-source report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyApplicationSourceReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const review = await buildApplicationSourceReview(repositoryState);

if (writeReport) {
  await writeApplicationSourceReport({ reportPath, repositoryState, review });
  if (verifyReport) {
    await verifyApplicationSourceReport(reportPath);
  }
} else {
  printSummary(repositoryState, review);
}

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
  const result = await runQuietCommand("git", ["status", "--short", "--branch"]);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || "git status unavailable").trim();
    return {
      available: false,
      branchLine: "unavailable",
      entries: [],
      error: detail,
    };
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const branchLine = lines.find((line) => line.startsWith("##")) || "unknown";
  const entries = lines
    .filter((line) => !line.startsWith("##"))
    .map(parseStatusEntry);

  return {
    available: true,
    branchLine,
    entries,
    error: "",
  };
}

function parseStatusEntry(line) {
  const status = line.slice(0, 2).trim() || "??";
  const rawPath = line.slice(3).trim();
  return {
    line,
    status,
    path: rawPath,
  };
}

async function buildApplicationSourceReview(repositoryState) {
  const entries = repositoryState.entries.filter((entry) => isApplicationSourcePath(entry.path));
  const expandedEntries = await expandApplicationEntries(entries);
  const groups = new Map();
  for (const entry of expandedEntries) {
    const group = applicationRiskGroup(entry.path);
    const current = groups.get(group.label) || { ...group, entries: [] };
    current.entries.push(entry);
    groups.set(group.label, current);
  }

  const guardrails = [
    {
      label: "Core pricing engine untouched",
      status: touchesCorePricingEngine(repositoryState.entries) ? "REVIEW" : "PASS",
      evidence: touchesCorePricingEngine(repositoryState.entries)
        ? "One or more core pricing/API helper paths are dirty and need explicit pricing-owner review."
        : "No dirty `src/utils/pricingDatabase.ts`, `src/utils/productPriceDisplay.ts`, `src/lib/api/pricingRead.ts`, `src/lib/api/productDetailRead.ts` or `src/lib/api/catalogRead.ts` paths are reported.",
    },
    {
      label: "POD admin/runtime untouched in application bucket",
      status: touchesPodApplicationSurface(repositoryState.entries) ? "REVIEW" : "PASS",
      evidence: touchesPodApplicationSurface(repositoryState.entries)
        ? "One or more POD admin/runtime paths are dirty and need POD-specific review before staging."
        : "No dirty `src/lib/pod*` or `src/pages/admin/Pod*` application paths are reported.",
    },
    {
      label: "Protected designer/PDF surface visible",
      status: expandedEntries.some((entry) => isProtectedDesignerPath(entry.path)) ? "REVIEW" : "PASS",
      evidence: expandedEntries.some((entry) => isProtectedDesignerPath(entry.path))
        ? "Designer/PDF files are dirty and must be reviewed with template/download/export proof, especially Salgsmapper."
        : "No protected designer/PDF source paths are dirty in this packet.",
    },
    {
      label: "Untracked runtime files visible",
      status: expandedEntries.some((entry) => entry.status === "??") ? "REVIEW" : "PASS",
      evidence: expandedEntries.some((entry) => entry.status === "??")
        ? "Untracked runtime files are included in the application-source packet and must be staged intentionally or ignored."
        : "No untracked runtime files are present in the application-source packet.",
    },
  ];

  return {
    status: expandedEntries.length > 0 ? "REVIEW REQUIRED" : "CLEAN",
    entries,
    expandedEntries,
    groups,
    guardrails,
  };
}

function isApplicationSourcePath(path) {
  if (path === "src/pages/admin/CommercialReadiness.tsx") return false;
  return path.startsWith("src/") || path === "vite.config.ts";
}

async function expandApplicationEntries(entries) {
  const expanded = [];
  for (const entry of entries) {
    if (entry.status === "??" && entry.path.endsWith("/")) {
      const files = await listFiles(entry.path).catch(() => []);
      if (files.length) {
        for (const file of files) {
          expanded.push({ ...entry, path: file, parentPath: entry.path });
        }
        continue;
      }
    }
    expanded.push(entry);
  }
  return expanded;
}

async function listFiles(root) {
  const dirents = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const dirent of dirents) {
    const path = `${root.replace(/\/$/, "")}/${dirent.name}`;
    if (dirent.isDirectory()) {
      files.push(...await listFiles(path));
    } else if (dirent.isFile()) {
      files.push(path);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function touchesCorePricingEngine(entries) {
  const corePricingPaths = new Set([
    "src/utils/pricingDatabase.ts",
    "src/utils/productPriceDisplay.ts",
    "src/lib/api/pricingRead.ts",
    "src/lib/api/productDetailRead.ts",
    "src/lib/api/catalogRead.ts",
  ]);
  return entries.some((entry) => corePricingPaths.has(entry.path));
}

function touchesPodApplicationSurface(entries) {
  return entries.some((entry) => (
    entry.path.startsWith("src/lib/pod")
    || entry.path.startsWith("src/pages/admin/Pod")
  ));
}

function isProtectedDesignerPath(path) {
  return (
    path === "src/pages/Designer.tsx"
    || path === "src/components/designer/EditorCanvas.tsx"
    || path === "src/components/designer/PDFImportModal.tsx"
    || path === "src/components/designer/PdfToolsPanel.tsx"
    || path.startsWith("src/lib/designer/")
  );
}

function applicationRiskGroup(path) {
  if (
    path.includes("product-price-page/")
    || path.includes("ProductPrice")
    || path.includes("PriceMatrix")
    || path.includes("pricing")
    || path.includes("Storformat")
  ) {
    return {
      label: "pricing/product flow",
      focus: "Verify preview rows, checkout handoff and warning-only guards without changing price calculations.",
    };
  }

  if (
    path.includes("/designer/")
    || path.includes("Designer.tsx")
    || path.includes("FileUploadConfiguration")
    || path.includes("TemplatesDownloadSection")
  ) {
    return {
      label: "designer/pdf/template",
      focus: "Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths.",
    };
  }

  if (
    path.includes("/storefront/")
    || path.includes("Header")
    || path.includes("Footer")
    || path.includes("Hero")
    || path.includes("ProductGrid")
    || path.includes("ProductMarquee")
    || path.includes("SEO")
    || path.includes("Index.tsx")
    || path.includes("siteDesign")
    || path.includes("Branding")
    || path.includes("Theme")
  ) {
    return {
      label: "tenant storefront/SEO/design",
      focus: "Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager.",
    };
  }

  if (
    path.includes("/admin/")
    || path.includes("Admin.tsx")
    || path.includes("Dashboard")
    || path.includes("OrderManager")
  ) {
    return {
      label: "admin operations",
      focus: "Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed.",
    };
  }

  if (
    path.includes("/checkout/")
    || path.includes("/account/")
    || path.includes("MyAccount")
    || path.includes("MyAddresses")
    || path.includes("MyOrders")
    || path.includes("MySettings")
  ) {
    return {
      label: "checkout/account",
      focus: "Verify customer checkout/account paths keep tenant context and do not regress order handoff.",
    };
  }

  if (path === "vite.config.ts") {
    return {
      label: "build/config",
      focus: "Verify the production build and localhost dev server behavior.",
    };
  }

  return {
    label: "runtime shared",
    focus: "Review as shared runtime code and verify with build plus the owned-tenant proof routes.",
  };
}

async function writeApplicationSourceReport({ reportPath, repositoryState, review }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Application Source Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${review.status}`,
    "",
    "This is a local, read-only application-source review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Review Summary",
    "",
    `Application source entries: ${review.entries.length}`,
    `Expanded runtime files: ${review.expandedEntries.length}`,
    `Risk groups: ${review.groups.size}`,
    "",
    "## Guardrail Checks",
    "",
    "| Status | Guardrail | Evidence |",
    "| --- | --- | --- |",
    ...review.guardrails.map((item) => `| ${item.status} | ${escapeMarkdownTable(item.label)} | ${escapeMarkdownTable(item.evidence)} |`),
    "",
    "## Runtime Risk Groups",
    "",
    "| Group | Files | Review focus | Suggested proof |",
    "| --- | ---: | --- | --- |",
    ...runtimeRiskGroupRows(review),
    "",
    "## Required Verification",
    "",
    "- `npm run build` must pass for the runtime application packet.",
    "- `npm run check:commercial-proof` must pass after runtime source changes.",
    "- Designer/PDF/template changes require manual Salgsmapper template/download/designer handoff review before external demo.",
    "- Pricing/product-flow changes must remain warning/read-only unless a specific price mutation was explicitly approved.",
    "- POD application paths require `POD2_README.md` review before staging if they appear dirty.",
    "",
    "## Application Candidate Files",
    "",
    "| Decision | Status | Path | Risk group | Review focus |",
    "| --- | --- | --- | --- | --- |",
    ...applicationCandidateRows(review),
    "",
    "## Suggested Packet Commands",
    "",
    "```sh",
    formatGitCommand("git add --", review.entries.map((entry) => entry.path)),
    "```",
    "",
    "```sh",
    "npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof",
    "```",
    "",
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial application-source report: ${reportPath}`);
}

function runtimeRiskGroupRows(review) {
  if (!review.groups.size) {
    return ["| none | 0 | No runtime application files are currently dirty. | `git status --short --branch` |"];
  }

  return [...review.groups.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => (
      `| ${escapeMarkdownTable(group.label)} | ${group.entries.length} | ${escapeMarkdownTable(group.focus)} | ${escapeMarkdownTable(suggestedProofForGroup(group.label))} |`
    ));
}

function suggestedProofForGroup(label) {
  if (label === "pricing/product flow") return "Open Webprinter Aluminium and verify price preview plus checkout handoff.";
  if (label === "designer/pdf/template") return "Open Salgsmapper standard folder and verify PDF template download plus designer handoff.";
  if (label === "tenant storefront/SEO/design") return "Open Webprinter, Salgsmapper and Onlinetryksager storefronts on desktop/mobile.";
  if (label === "admin operations") return "Open relevant admin surfaces as `admin@webprinter.dk` and verify tenant context.";
  if (label === "checkout/account") return "Open checkout handoff and customer account pages without changing live data.";
  if (label === "build/config") return "Run `npm run build` and keep localhost on the expected port.";
  return "Run build and owned-tenant proof routes.";
}

function applicationCandidateRows(review) {
  if (!review.expandedEntries.length) {
    return ["| REVIEW | clean | none | none | No application-source entries are currently dirty. |"];
  }

  return review.expandedEntries.map((entry) => {
    const group = applicationRiskGroup(entry.path);
    return `| REVIEW | ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(group.label)} | ${escapeMarkdownTable(group.focus)} |`;
  });
}

async function verifyApplicationSourceReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Application Source Report",
    "Status:",
    "This is a local, read-only application-source review artifact.",
    "It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "## Review Summary",
    "Application source entries:",
    "Expanded runtime files:",
    "Risk groups:",
    "## Guardrail Checks",
    "Core pricing engine untouched",
    "POD admin/runtime untouched in application bucket",
    "Protected designer/PDF surface visible",
    "Untracked runtime files visible",
    "## Runtime Risk Groups",
    "## Required Verification",
    "npm run build",
    "npm run check:commercial-proof",
    "## Application Candidate Files",
    "## Suggested Packet Commands",
    "git add --",
    "check:commercial-application-source:write",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing application-source report marker: ${marker}`);
    }
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Application-source report is missing a parseable Generated timestamp.");
  }

  const sourceEntriesLine = content.split("\n").find((line) => line.startsWith("Application source entries: "));
  const sourceEntries = Number.parseInt(sourceEntriesLine?.slice("Application source entries: ".length).trim() || "", 10);
  if (!Number.isInteger(sourceEntries) || sourceEntries < 0) {
    problems.push("Application-source report is missing a valid Application source entries count.");
  }

  if (problems.length) {
    console.error(`Commercial application-source report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial application-source report check passed: ${path}`);
}

function printSummary(repositoryState, review) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${review.status}`);
  console.log(`Application source entries: ${review.entries.length}`);
  console.log(`Expanded runtime files: ${review.expandedEntries.length}`);
  for (const group of [...review.groups.values()].sort((a, b) => a.label.localeCompare(b.label))) {
    console.log(`- ${group.label}: ${group.entries.length}`);
  }
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

function formatGitCommand(prefix, paths) {
  if (!paths.length) return `${prefix} # no files`;
  return [
    prefix,
    ...paths.map((path) => quoteShellPath(path)),
  ].join(" \\\n  ");
}

function quoteShellPath(path) {
  return `'${String(path).replaceAll("'", "'\\''")}'`;
}
