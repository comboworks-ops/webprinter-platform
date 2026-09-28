#!/usr/bin/env node

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_RUN = path.resolve(
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z"
);
const DEFAULT_PYTHON =
  "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const SANITIZER = path.resolve(
  "scripts/product-templates/sanitize_wmd_advent_template.py"
);
const EXISTING_KIND_TEMPLATE = path.resolve(
  "output/pdf/julekalender-mini-mix-tryk-skabelon.pdf"
);

function parseArgs(argv) {
  const args = {
    run: DEFAULT_RUN,
    download: false,
    sanitize: false,
    contractOnly: false,
    variant: null,
    concurrency: 4,
    dpi: 200,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--run") args.run = path.resolve(argv[++index]);
    else if (token === "--download") args.download = true;
    else if (token === "--sanitize") args.sanitize = true;
    else if (token === "--all") args.download = args.sanitize = true;
    else if (token === "--contract-only") args.contractOnly = true;
    else if (token === "--variant") args.variant = argv[++index];
    else if (token === "--concurrency") args.concurrency = Number(argv[++index]);
    else if (token === "--dpi") args.dpi = Number(argv[++index]);
    else if (token === "--help") {
      console.log(
        "Usage: node prepare-wmd-advent-calendar-documents.js [--run DIR] [--download] [--sanitize] [--all] [--contract-only] [--variant KEY] [--concurrency N] [--dpi N]"
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.download && !args.sanitize && !args.contractOnly) args.download = args.sanitize = true;
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 8) {
    throw new Error("--concurrency must be an integer from 1 to 8");
  }
  if (!Number.isInteger(args.dpi) || args.dpi < 120 || args.dpi > 300) {
    throw new Error("--dpi must be an integer from 120 to 300");
  }
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function listPackages(runDirectory) {
  const root = path.join(runDirectory, "families");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const packages = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = path.join(root, entry.name);
    const manifestPath = path.join(directory, "import-manifest.json");
    const manifest = await readJson(manifestPath);
    packages.push({ directory, manifestPath, manifest });
  }
  return packages;
}

async function downloadFile(url, filePath) {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > 1000) return { cached: true, bytes: stat.size };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36",
          accept: "application/pdf,*/*;q=0.8",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") || "";
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 1000 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
        throw new Error(`Not a PDF (${contentType}, ${bytes.length} bytes)`);
      }
      await fs.writeFile(filePath, bytes);
      return { cached: false, bytes: bytes.length };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`Download failed: ${url}: ${lastError?.message || lastError}`);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}: ${stderr || stdout}`));
    });
  });
}

function parseDimension(value) {
  const match = String(value || "").match(/([0-9]+(?:[.,][0-9]+)?)\s*[×x]\s*([0-9]+(?:[.,][0-9]+)?)\s*mm/i);
  if (!match) return null;
  return {
    widthMm: Number(match[1].replace(",", ".")),
    heightMm: Number(match[2].replace(",", ".")),
  };
}

async function sha256(filePath) {
  return crypto.createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function runLimited(items, concurrency, worker) {
  let index = 0;
  const output = new Array(items.length);
  async function next() {
    while (index < items.length) {
      const current = index++;
      output[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, next));
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const packages = await listPackages(args.run);
  const jobs = packages.flatMap((packageInfo) =>
    packageInfo.manifest.documents.map((document) => ({ packageInfo, document }))
  ).filter((job) => !args.variant || job.document.key === args.variant);
  if (!jobs.length) throw new Error("No matching document jobs");
  await fs.mkdir(path.resolve("output/pdf"), { recursive: true });

  const results = await runLimited(jobs, args.concurrency, async (job, index) => {
    const { packageInfo, document } = job;
    const documentsDirectory = path.join(packageInfo.directory, "documents");
    const sourceGuide = path.join(documentsDirectory, `source-${document.key}-guide.pdf`);
    const sourceTemplate = path.join(documentsDirectory, `source-${document.key}-template.pdf`);
    const sanitizedPath = path.join(packageInfo.directory, document.template.sanitizedPdfPath);
    const inspectionPath = path.join(documentsDirectory, `${document.key}-pdf-inspection.json`);
    const finalOutputPath =
      document.key === "kinder-mini-mix"
        ? EXISTING_KIND_TEMPLATE
        : path.resolve(
            "output/pdf",
            `${packageInfo.manifest.product.slugDa}-${document.key}-tryk-skabelon.pdf`
          );

    if (args.download) {
      await Promise.all([
        downloadFile(document.guide.sourceUrl, sourceGuide),
        downloadFile(document.template.sourceUrl, sourceTemplate),
      ]);
    }
    if (args.sanitize) {
      await runProcess(DEFAULT_PYTHON, [
        SANITIZER,
        "--source",
        sourceTemplate,
        "--output",
        finalOutputPath,
        "--product-name",
        packageInfo.manifest.product.nameDa,
        "--inspection",
        inspectionPath,
        "--dpi",
        String(args.dpi),
      ]);
      await fs.copyFile(finalOutputPath, sanitizedPath);
    }

    const inspection = (args.sanitize || args.contractOnly) ? await readJson(inspectionPath) : null;
    console.log(
      `OK ${index + 1}/${jobs.length} ${packageInfo.manifest.product.slugDa}/${document.key}`
    );
    return {
      slug: packageInfo.manifest.product.slugDa,
      variant: document.key,
      packageInfo,
      sanitizedPath,
      finalOutputPath,
      inspectionPath,
      inspection,
    };
  });

  if (args.sanitize || args.contractOnly) {
    const grouped = new Map();
    for (const result of results) {
      const list = grouped.get(result.packageInfo.manifestPath) || [];
      list.push(result);
      grouped.set(result.packageInfo.manifestPath, list);
    }
    for (const packageInfo of packages) {
      const packageResults = grouped.get(packageInfo.manifestPath);
      if (!packageResults) continue;
      const pricingAxes = new Set(
        (packageInfo.manifest.optionGroups || []).map((group) => String(group.key || "").trim()).filter(Boolean),
      );
      const templateBindingAxes = Object.keys(packageInfo.manifest.documents[0]?.match || {})
        .filter((axis) => pricingAxes.has(axis))
        .filter((axis) => packageInfo.manifest.documents.every((document) => (
          Object.prototype.hasOwnProperty.call(document.match || {}, axis)
        )));
      if (templateBindingAxes.length === 0) {
        throw new Error(`${packageInfo.manifest.product.slugDa}: no exact pricing axis binds the Designer templates`);
      }
      packageInfo.manifest.templateBindingAxes = templateBindingAxes;
      for (const result of packageResults) {
        const document = packageInfo.manifest.documents.find((item) => item.key === result.variant);
        document.match = Object.fromEntries(
          templateBindingAxes.map((axis) => [axis, document.match[axis]]),
        );
        const dataDimensions = parseDimension(result.inspection.dataFormat) || {
          widthMm: result.inspection.pageWidthMm,
          heightMm: result.inspection.pageHeightMm,
        };
        document.guide.factsReviewed = true;
        document.template.widthMm = dataDimensions.widthMm;
        document.template.heightMm = dataDimensions.heightMm;
        document.template.bleedMm = result.inspection.bleedMm ?? 0;
        document.template.safeMm = result.inspection.safeMm ?? 2;
        document.template.metadataRemoved = true;
        document.template.supplierBrandingRemoved = true;
        document.template.sanitizedPdfSha256 = await sha256(result.sanitizedPath);
        document.template.designerLoadMode = "locked_non_printing_guide_overlay";
        document.template.lockedInDesigner = true;
        document.template.nonPrintingOverlay = true;
        document.template.excludedFromExport = true;
        document.template.designerVerification = {
          status: "pending",
          evidencePath: null,
        };
        document.template.finalOutputPath = path.relative(packageInfo.directory, result.finalOutputPath);
        document.template.inspectionPath = path.relative(packageInfo.directory, result.inspectionPath);
        if (result.inspection.finalFormat) {
          document.template.finalFormat = result.inspection.finalFormat;
        }
      }
      await writeJson(packageInfo.manifestPath, packageInfo.manifest);
    }
  }

  await writeJson(path.join(args.run, "families/document-preparation-summary.json"), {
    schemaVersion: 1,
    preparedAt: new Date().toISOString(),
    download: args.download,
    sanitize: args.sanitize,
    contractOnly: args.contractOnly,
    dpi: args.dpi,
    jobs: results.map((result) => ({
      slug: result.slug,
      variant: result.variant,
      sanitizedPath: result.sanitizedPath,
      finalOutputPath: result.finalOutputPath,
      inspectionPath: result.inspectionPath,
      pageWidthMm: result.inspection?.pageWidthMm ?? null,
      pageHeightMm: result.inspection?.pageHeightMm ?? null,
      bleedMm: result.inspection?.bleedMm ?? null,
      safeMm: result.inspection?.safeMm ?? null,
    })),
  });
  console.log(`Prepared document pairs: ${results.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
