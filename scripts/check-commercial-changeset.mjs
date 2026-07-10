#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DEFAULT_REPORT_PATH = "docs/COMMERCIAL_CHANGESET_LATEST.md";
const FILES_PER_BUCKET_LIMIT = 30;
const FIRST_REVIEW_BUCKET = "commercial-proof-chain";
const SECOND_REVIEW_BUCKET = "application-source";
const args = process.argv.slice(2);
const reportPath = readArg("--report-path", DEFAULT_REPORT_PATH);
const writeReport = hasFlag("--write-report");
const verifyReport = hasFlag("--verify-report");

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only commercial changeset report.

Usage:
  node scripts/check-commercial-changeset.mjs
  node scripts/check-commercial-changeset.mjs --write-report
  node scripts/check-commercial-changeset.mjs --verify-report

Options:
  --write-report   Write a local markdown changeset report.
  --verify-report  Verify the local markdown changeset report structure.
  --report-path    Report path. Default: ${DEFAULT_REPORT_PATH}
`);
  process.exit(0);
}

if (verifyReport && !writeReport) {
  await verifyChangesetReport(reportPath);
  process.exit(0);
}

const repositoryState = await readRepositoryState();
const changeset = buildChangeset(repositoryState);

if (writeReport) {
  await writeChangesetReport({ reportPath, repositoryState, changeset });
  if (verifyReport) {
    await verifyChangesetReport(reportPath);
  }
} else {
  printSummary(repositoryState, changeset);
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
  const rawPath = normalizeStatusPath(line.slice(3).trim());
  return {
    line,
    status,
    path: rawPath,
    bucket: classifyPath(rawPath),
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

function classifyPath(path) {
  if (
    path === "src/pages/admin/CommercialReadiness.tsx"
    || path === "package.json"
    || path === "package-lock.json"
    || path === ".gitignore"
    || path === "AI_CONTINUITY.md"
    || path === "HANDOVER.md"
    || path === ".agent/HANDOVER.md"
    || path.startsWith("scripts/check-commercial")
    || path === "scripts/check-tenant-proof-routes.mjs"
    || path.startsWith("docs/COMMERCIAL_")
  ) {
    return "commercial-proof-chain";
  }

  if (path.startsWith("src/") || path === "vite.config.ts") {
    return "application-source";
  }

  if (path.startsWith("supabase/")) {
    return "supabase";
  }

  if (
    path.startsWith("docs/SUPPLIER_BANK_")
    || path.startsWith("docs/PIXART_")
    || path.startsWith("blueprints/")
  ) {
    return "supplier-bank-evidence";
  }

  if (
    path.endsWith(".md")
    || path.startsWith("docs/")
    || path.startsWith(".agent/")
    || path === "AGENTS.md"
    || path === "AI_CONTINUITY.md"
    || path === "HANDOVER.md"
    || path === "SYSTEM_OVERVIEW.md"
  ) {
    return "documentation";
  }

  if (
    path.startsWith(".agents/")
    || path.startsWith(".codex/")
    || path.startsWith(".github/")
    || path === "deno.lock"
    || path === "supabase/.temp/cli-latest"
  ) {
    return "local-tooling";
  }

  return "other";
}

function buildChangeset(repositoryState) {
  const buckets = new Map();
  for (const entry of repositoryState.entries) {
    const current = buckets.get(entry.bucket) || [];
    current.push(entry);
    buckets.set(entry.bucket, current);
  }

  const dirtyEntries = repositoryState.entries.length;
  const untrackedEntries = repositoryState.entries.filter((entry) => entry.status === "??").length;
  const modifiedEntries = repositoryState.entries.filter((entry) => entry.status !== "??").length;
  const branchBehind = repositoryState.branchLine.includes("[behind");
  const applicationSourceEntries = buckets.get("application-source")?.length || 0;
  const commercialProofEntries = buckets.get("commercial-proof-chain")?.length || 0;
  const supabaseEntries = buckets.get("supabase")?.length || 0;
  const status = dirtyEntries > 0 ? "REVIEW REQUIRED" : "CLEAN";

  return {
    status,
    dirtyEntries,
    untrackedEntries,
    modifiedEntries,
    branchBehind,
    applicationSourceEntries,
    commercialProofEntries,
    supabaseEntries,
    buckets,
  };
}

async function writeChangesetReport({ reportPath, repositoryState, changeset }) {
  const generatedAt = new Date().toISOString();
  const markdown = [
    "# Commercial Changeset Report",
    "",
    `Generated: ${generatedAt}`,
    "Git status command: `git status --short --branch`",
    `Branch: ${repositoryState.branchLine}`,
    `Status: ${changeset.status}`,
    "",
    "This is a local, read-only changeset artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.",
    "",
    "## Review Summary",
    "",
    `Dirty entries: ${changeset.dirtyEntries}`,
    `Tracked modified entries: ${changeset.modifiedEntries}`,
    `Untracked entries: ${changeset.untrackedEntries}`,
    `Commercial proof-chain entries: ${changeset.commercialProofEntries}`,
    `Application source entries: ${changeset.applicationSourceEntries}`,
    `Supabase entries: ${changeset.supabaseEntries}`,
    "",
    "## Bucket Counts",
    "",
    "| Bucket | Entries | Review meaning |",
    "| --- | ---: | --- |",
    ...bucketRows(changeset),
    "",
    "## Suggested Review Order",
    "",
    "| Order | Bucket | Entries | Why now | Suggested verification |",
    "| ---: | --- | ---: | --- | --- |",
    ...suggestedReviewOrderRows(changeset),
    "",
    "## Bucket Verification Commands",
    "",
    "| Bucket | Command | Purpose |",
    "| --- | --- | --- |",
    ...bucketCommandRows(changeset),
    "",
    "## First Review Packet: Commercial Proof-Chain",
    "",
    "Purpose: review the smallest coherent release-safety slice first: cockpit UI, proof scripts, npm command wiring and generated local proof artifacts.",
    `Packet entries: ${changeset.buckets.get(FIRST_REVIEW_BUCKET)?.length || 0}`,
    `Hold outside first packet: ${Math.max(0, changeset.dirtyEntries - (changeset.buckets.get(FIRST_REVIEW_BUCKET)?.length || 0))}`,
    "Suggested packet verification: `npm run check:commercial-release`",
    "Suggested staging command preview:",
    "",
    "```sh",
    formatGitCommand("git add --", firstReviewPacketPaths(changeset)),
    "```",
    "",
    "Suggested staged-file validation:",
    "",
    "```sh",
    formatGitCommand("git diff --cached --name-only --", firstReviewPacketPaths(changeset)),
    "```",
    "",
    "Suggested unstaging rollback:",
    "",
    "```sh",
    formatGitCommand("git restore --staged --", firstReviewPacketPaths(changeset)),
    "```",
    "",
    "### Candidate Files",
    "",
    "| Decision | Status | Path | Why it belongs in packet |",
    "| --- | --- | --- | --- |",
    ...firstReviewPacketRows(changeset),
    "",
    "### Hold Outside First Packet",
    "",
    "| Bucket | Entries | Hold reason |",
    "| --- | ---: | --- |",
    ...holdOutsideFirstPacketRows(changeset),
    "",
    "## Second Review Packet: Application Source",
    "",
    "Purpose: review the runtime application changes only after the commercial proof-chain packet is trusted. This packet can affect tenants, storefronts, designer handoff, checkout, account pages, SEO and admin operations.",
    `Packet entries: ${applicationReviewPacketEntries(changeset).length}`,
    "Suggested packet verification: `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof`",
    "Suggested staging command preview:",
    "",
    "```sh",
    formatGitCommand("git add --", applicationReviewPacketPaths(changeset)),
    "```",
    "",
    "Suggested staged-file validation:",
    "",
    "```sh",
    formatGitCommand("git diff --cached --name-only --", applicationReviewPacketPaths(changeset)),
    "```",
    "",
    "Suggested unstaging rollback:",
    "",
    "```sh",
    formatGitCommand("git restore --staged --", applicationReviewPacketPaths(changeset)),
    "```",
    "",
    "### Runtime Risk Groups",
    "",
    "| Group | Files | Review focus |",
    "| --- | ---: | --- |",
    ...applicationRiskGroupRows(changeset),
    "",
    "### Application Candidate Files",
    "",
    "| Decision | Status | Path | Risk group | Review focus |",
    "| --- | --- | --- | --- | --- |",
    ...applicationReviewPacketRows(changeset),
    "",
    "## Review Gates",
    "",
    "| Status | Gate | Evidence |",
    "| --- | --- | --- |",
    `| ${changeset.branchBehind ? "REVIEW" : "PASS"} | Branch freshness | ${escapeMarkdownTable(changeset.branchBehind ? "Local branch is behind remote; review before push/deploy." : "Local branch is not reported behind remote.")} |`,
    `| ${changeset.dirtyEntries > 0 ? "REVIEW" : "PASS"} | Worktree scope | ${escapeMarkdownTable(`${changeset.dirtyEntries} dirty entries need review before a production push.`)} |`,
    `| ${changeset.applicationSourceEntries > 0 ? "REVIEW" : "PASS"} | App source touched | ${escapeMarkdownTable(`${changeset.applicationSourceEntries} application-source entries are in the current worktree.`)} |`,
    `| ${changeset.supabaseEntries > 0 ? "REVIEW" : "PASS"} | Supabase touched | ${escapeMarkdownTable(`${changeset.supabaseEntries} Supabase entries are in the current worktree; check grants/RLS before DB deploys.`)} |`,
    `| ${changeset.commercialProofEntries > 0 ? "PASS" : "REVIEW"} | Commercial proof chain visible | ${escapeMarkdownTable(`${changeset.commercialProofEntries} entries are part of the commercial proof chain/reporting surface.`)} |`,
    "",
    "## Files By Bucket",
    "",
    ...filesByBucket(changeset),
  ].join("\n");

  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote commercial changeset report: ${reportPath}`);
}

function bucketRows(changeset) {
  const rows = [];
  for (const [bucket, entries] of [...changeset.buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push(`| ${escapeMarkdownTable(bucket)} | ${entries.length} | ${escapeMarkdownTable(bucketMeaning(bucket))} |`);
  }
  if (!rows.length) {
    rows.push("| clean | 0 | No dirty entries reported. |");
  }
  return rows;
}

function bucketMeaning(bucket) {
  if (bucket === "commercial-proof-chain") return "Commercial cockpit, proof scripts, generated proof reports or package wiring.";
  if (bucket === "application-source") return "Runtime application code that needs normal browser/build review.";
  if (bucket === "supabase") return "Database/functions/tooling area; review grants, RLS and deployment safety.";
  if (bucket === "supplier-bank-evidence") return "Supplier Bank/Pixart evidence or planning files, not storefront runtime by itself.";
  if (bucket === "documentation") return "Handover, continuity, roadmap or audit documentation.";
  if (bucket === "local-tooling") return "Local agent, CI/tooling or generated support files.";
  return "Needs manual classification before release.";
}

function suggestedReviewOrderRows(changeset) {
  const reviewOrder = [
    {
      bucket: "commercial-proof-chain",
      why: "Smallest coherent release-safety slice; proves the cockpit, reports and gates before touching broader app code.",
      command: "npm run check:commercial-release",
    },
    {
      bucket: "application-source",
      why: "Runtime changes affect tenants and storefront behavior; review after the proof chain is trusted.",
      command: "npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof",
    },
    {
      bucket: "supabase",
      why: "Database/functions can affect live data; review grants/RLS/function exposure before any deploy.",
      command: "npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions",
    },
    {
      bucket: "supplier-bank-evidence",
      why: "Large evidence set; keep as a separate documentation/review packet from runtime changes.",
      command: "npm run supplier-bank:doctor && npm run supplier-bank:status-report",
    },
    {
      bucket: "documentation",
      why: "Documentation should match the reviewed implementation and not hide unresolved production risks.",
      command: "npm run check:commercial-changeset-report",
    },
    {
      bucket: "local-tooling",
      why: "Local/tooling artifacts should be intentionally included or ignored before staging.",
      command: "git status --short --branch",
    },
    {
      bucket: "other",
      why: "Unclassified paths need manual owner decision before they can enter a release.",
      command: "git status --short --branch",
    },
  ];

  return reviewOrder
    .map((item, index) => ({
      ...item,
      order: index + 1,
      count: changeset.buckets.get(item.bucket)?.length || 0,
    }))
    .filter((item) => item.count > 0)
    .map((item) => (
      `| ${item.order} | ${escapeMarkdownTable(item.bucket)} | ${item.count} | ${escapeMarkdownTable(item.why)} | \`${escapeMarkdownCode(item.command)}\` |`
    ));
}

function bucketCommandRows(changeset) {
  const commands = [
    {
      bucket: "commercial-proof-chain",
      command: "npm run check:commercial-release",
      purpose: "Regenerate proof, changeset, release reports and run the production build.",
    },
    {
      bucket: "application-source",
      command: "npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof",
      purpose: "Generate the runtime review packet, then compile and re-run owned-tenant proof routes.",
    },
    {
      bucket: "supabase",
      command: "npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions",
      purpose: "Generate the Supabase review packet, then check public grants/RLS decisions and Edge Function exposure.",
    },
    {
      bucket: "supplier-bank-evidence",
      command: "npm run supplier-bank:doctor && npm run supplier-bank:status-report",
      purpose: "Check Supplier Bank tooling/report visibility without writing supplier data.",
    },
    {
      bucket: "documentation",
      command: "npm run check:commercial-readiness",
      purpose: "Keep documented commercial proof commands aligned with the cockpit and scripts.",
    },
    {
      bucket: "local-tooling",
      command: "git status --short --branch",
      purpose: "Confirm local/tooling paths are intentionally included or ignored before staging.",
    },
    {
      bucket: "other",
      command: "git status --short --branch",
      purpose: "Manually classify unowned paths before staging.",
    },
  ];

  const rows = commands
    .filter((item) => (changeset.buckets.get(item.bucket)?.length || 0) > 0)
    .map((item) => (
      `| ${escapeMarkdownTable(item.bucket)} | \`${escapeMarkdownCode(item.command)}\` | ${escapeMarkdownTable(item.purpose)} |`
    ));

  if (!rows.length) {
    rows.push("| clean | `git status --short --branch` | Confirm no dirty entries are reported. |");
  }

  return rows;
}

function firstReviewPacketRows(changeset) {
  const entries = firstReviewPacketEntries(changeset);
  if (!entries.length) {
    return ["| REVIEW | clean | none | No commercial proof-chain entries are currently dirty. |"];
  }

  return entries.map((entry) => (
    `| INCLUDE | ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(firstReviewPacketReason(entry.path))} |`
  ));
}

function firstReviewPacketEntries(changeset) {
  return changeset.buckets.get(FIRST_REVIEW_BUCKET) || [];
}

function firstReviewPacketPaths(changeset) {
  return firstReviewPacketEntries(changeset).map((entry) => entry.path);
}

function firstReviewPacketReason(path) {
  if (path === ".gitignore") return "Allows commercial proof scripts to be tracked instead of ignored.";
  if (path === "AI_CONTINUITY.md" || path === "HANDOVER.md" || path === ".agent/HANDOVER.md") {
    return "Documents the commercial proof, release and application-source review commands required by the binding guard.";
  }
  if (path === "package.json" || path === "package-lock.json") return "Exposes and locks the commercial proof/report npm commands.";
  if (path === "src/pages/admin/CommercialReadiness.tsx") return "Shows the read-only proof chain, reports and commands in the admin cockpit.";
  if (path === "docs/COMMERCIAL_PROOF_LATEST.md") return "Generated tenant proof artifact with the 9/9 proof evidence.";
  if (path === "docs/COMMERCIAL_CHANGESET_LATEST.md") return "Generated review-bucket artifact for current dirty worktree.";
  if (path === "docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md") return "Generated runtime application-source review artifact for the second packet.";
  if (path === "docs/COMMERCIAL_SUPABASE_LATEST.md") return "Generated Supabase review artifact with grant and function exposure checks.";
  if (path === "docs/COMMERCIAL_RELEASE_LATEST.md") return "Generated release summary tying proof, changeset and build together.";
  if (path === "scripts/check-commercial-application-source.mjs") return "Generates and verifies the runtime application-source review packet.";
  if (path === "scripts/check-commercial-supabase.mjs") return "Generates and verifies the Supabase review packet.";
  if (path === "scripts/check-commercial-changeset.mjs") return "Generates and verifies the dirty-worktree review packet.";
  if (path === "scripts/check-commercial-proof.mjs") return "Runs the read-only commercial proof gate and proof report writer.";
  if (path === "scripts/check-commercial-proof-report.mjs") return "Verifies the generated commercial proof report.";
  if (path === "scripts/check-commercial-readiness-bindings.js") return "Protects cockpit/script/report drift markers.";
  if (path === "scripts/check-commercial-release.mjs") return "Runs the release gate across proof, changeset and production build.";
  if (path === "scripts/check-commercial-release-report.mjs") return "Verifies the release summary artifact.";
  if (path === "scripts/check-tenant-proof-routes.mjs") return "Runs owned-tenant browser proof routes with transient Supabase retry.";
  return "Classified as commercial proof-chain by path.";
}

function holdOutsideFirstPacketRows(changeset) {
  const rows = [];
  for (const [bucket, entries] of [...changeset.buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (bucket === FIRST_REVIEW_BUCKET) continue;
    rows.push(`| ${escapeMarkdownTable(bucket)} | ${entries.length} | ${escapeMarkdownTable(holdReason(bucket))} |`);
  }
  if (!rows.length) {
    rows.push("| none | 0 | No other buckets have dirty entries. |");
  }
  return rows;
}

function holdReason(bucket) {
  if (bucket === "application-source") return "Review after proof-chain packet because these files affect runtime tenant behavior.";
  if (bucket === "supabase") return "Review separately with grants/RLS/function exposure checks before DB/function deploy.";
  if (bucket === "supplier-bank-evidence") return "Keep as a separate evidence packet; it is large and not a runtime release slice by itself.";
  if (bucket === "documentation") return "Review after implementation packet so docs match the accepted release state.";
  if (bucket === "local-tooling") return "Decide intentionally whether local/tooling paths belong in source control.";
  if (bucket === "other") return "Manually classify before staging.";
  return "Hold for manual owner review.";
}

function applicationReviewPacketEntries(changeset) {
  return changeset.buckets.get(SECOND_REVIEW_BUCKET) || [];
}

function applicationReviewPacketPaths(changeset) {
  return applicationReviewPacketEntries(changeset).map((entry) => entry.path);
}

function applicationReviewPacketRows(changeset) {
  const entries = applicationReviewPacketEntries(changeset);
  if (!entries.length) {
    return ["| REVIEW | clean | none | none | No application-source entries are currently dirty. |"];
  }

  return entries.map((entry) => {
    const group = applicationRiskGroup(entry.path);
    return `| REVIEW | ${escapeMarkdownTable(entry.status)} | \`${escapeMarkdownCode(entry.path)}\` | ${escapeMarkdownTable(group.label)} | ${escapeMarkdownTable(group.focus)} |`;
  });
}

function applicationRiskGroupRows(changeset) {
  const entries = applicationReviewPacketEntries(changeset);
  if (!entries.length) {
    return ["| none | 0 | No runtime application files are currently dirty. |"];
  }

  const counts = new Map();
  for (const entry of entries) {
    const group = applicationRiskGroup(entry.path);
    const current = counts.get(group.label) || { ...group, count: 0 };
    current.count += 1;
    counts.set(group.label, current);
  }

  return [...counts.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((group) => `| ${escapeMarkdownTable(group.label)} | ${group.count} | ${escapeMarkdownTable(group.focus)} |`);
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

function filesByBucket(changeset) {
  const sections = [];
  for (const [bucket, entries] of [...changeset.buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sections.push(`### ${bucket}`);
    sections.push("");
    for (const entry of entries.slice(0, FILES_PER_BUCKET_LIMIT)) {
      sections.push(`- \`${entry.status}\` ${entry.path}`);
    }
    const omitted = entries.length - FILES_PER_BUCKET_LIMIT;
    if (omitted > 0) {
      sections.push(`- ... ${omitted} more entries omitted`);
    }
    sections.push("");
  }
  if (!sections.length) {
    sections.push("### clean", "", "- No dirty entries reported.", "");
  }
  return sections;
}

async function verifyChangesetReport(path) {
  const content = await readFile(path, "utf8");
  const problems = [];
  const requiredMarkers = [
    "# Commercial Changeset Report",
    "Git status command: `git status --short --branch`",
    "Status:",
    "This is a local, read-only changeset artifact.",
    "## Review Summary",
    "Dirty entries:",
    "Tracked modified entries:",
    "Untracked entries:",
    "Commercial proof-chain entries:",
    "Application source entries:",
    "Supabase entries:",
    "## Bucket Counts",
    "## Suggested Review Order",
    "## Bucket Verification Commands",
    "## First Review Packet: Commercial Proof-Chain",
    "Packet entries:",
    "Hold outside first packet:",
    "Suggested packet verification: `npm run check:commercial-release`",
    "Suggested staging command preview:",
    "Suggested staged-file validation:",
    "Suggested unstaging rollback:",
    "git add --",
    "git diff --cached --name-only --",
    "git restore --staged --",
    "### Candidate Files",
    "### Hold Outside First Packet",
    "## Second Review Packet: Application Source",
    "Runtime Risk Groups",
    "Application Candidate Files",
    "pricing/product flow",
    "designer/pdf/template",
    "tenant storefront/SEO/design",
    "INCLUDE",
    "Suggested verification",
    "commercial-proof-chain",
    "npm run check:commercial-release",
    "application-source",
    "npm run check:commercial-application-source:write",
    "npm run check:commercial-supabase:write",
    "npm run check:supabase-grants",
    "npm run check:supabase-functions",
    "npm run build",
    "## Review Gates",
    "Branch freshness",
    "Worktree scope",
    "Commercial proof chain visible",
    "## Files By Bucket",
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      problems.push(`Missing changeset report marker: ${marker}`);
    }
  }

  const generatedLine = content.split("\n").find((line) => line.startsWith("Generated: "));
  const generatedAt = generatedLine?.slice("Generated: ".length).trim();
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    problems.push("Changeset report is missing a parseable Generated timestamp.");
  }

  const dirtyEntriesLine = content.split("\n").find((line) => line.startsWith("Dirty entries: "));
  const dirtyEntries = Number.parseInt(dirtyEntriesLine?.slice("Dirty entries: ".length).trim() || "", 10);
  if (!Number.isInteger(dirtyEntries) || dirtyEntries < 0) {
    problems.push("Changeset report is missing a valid Dirty entries count.");
  }

  if (problems.length) {
    console.error(`Commercial changeset report check failed for ${path}:`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Commercial changeset report check passed: ${path}`);
}

function printSummary(repositoryState, changeset) {
  console.log(`Branch: ${repositoryState.branchLine}`);
  console.log(`Status: ${changeset.status}`);
  console.log(`Dirty entries: ${changeset.dirtyEntries}`);
  console.log(`Commercial proof-chain entries: ${changeset.commercialProofEntries}`);
  console.log(`Application source entries: ${changeset.applicationSourceEntries}`);
  console.log(`Supabase entries: ${changeset.supabaseEntries}`);
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
