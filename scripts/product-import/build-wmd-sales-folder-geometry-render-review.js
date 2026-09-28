#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = "scripts/product-import/build-wmd-sales-folder-geometry-render-review.js";
const DEFAULT_SUPPLEMENT_PATH = "review/template-geometry-supplement.json";
const OUTPUT_PATH = "review/template-geometry-render-review";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  supplementApprovalRecorded: false,
  supplementReviewStateChanged: false,
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfUploaded: false,
  databaseWritten: false,
  productOrTemplateRecordWritten: false,
  published: false,
});

export class GeometryRenderReviewError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "GeometryRenderReviewError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new GeometryRenderReviewError(message, details);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256Json(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), "en", { numeric: true })
  );
}

function validSha256(value, label) {
  const normalized = String(value || "");
  assert(SHA256_PATTERN.test(normalized), `${label} is not a lowercase SHA-256`);
  return normalized;
}

function safeRelativePath(value, label, requiredPrefix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized !== "" && !path.posix.isAbsolute(normalized), `${label} must be relative`);
  assert(!normalized.split("/").includes(".."), `${label} cannot escape the run directory`);
  if (requiredPrefix) {
    assert(normalized.startsWith(requiredPrefix), `${label} must start with ${requiredPrefix}`);
  }
  return normalized;
}

function pathWithin(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} escapes its allowed root`);
  return resolved;
}

function geometryKey(geometry) {
  return [
    String(geometry?.format || ""),
    String(geometry?.construction || ""),
    String(geometry?.print || ""),
    `${Number(geometry?.spine)}mm`,
  ].join(" | ");
}

function validateSupplement(supplement) {
  assert(supplement?.kind === "wmd_sales_folder_geometry_supplement", "Unexpected supplement kind");
  assert(supplement?.schemaVersion === 1, "Geometry supplement schemaVersion must be 1");
  assert(supplement?.reviewState === "pending_review", "Only a pending-review supplement may be rendered");
  assert(Array.isArray(supplement?.entries) && supplement.entries.length > 0, "Geometry supplement has no entries");
  for (const key of ["sourcePdfModified", "sourcePdfSanitized", "sourcePdfUploaded", "databaseWritten", "published"]) {
    if (key in (supplement.prohibitedActionsPerformed || {})) {
      assert(supplement.prohibitedActionsPerformed[key] === false, `Supplement reports prohibited action: ${key}`);
    }
  }
}

/**
 * Collapse the 121 supplement entries into exact byte-identity pairs.  Local
 * paths are deliberately not part of the pair key because supplier files with
 * identical bytes were downloaded under several binding-specific filenames.
 */
export function collectUniqueRenderPairs(supplement) {
  validateSupplement(supplement);
  const groups = new Map();
  for (const entry of supplement.entries) {
    const sourceSha256 = validSha256(entry?.sourceTemplateSha256, "Source template SHA-256");
    const sourceIdentitySha = validSha256(entry?.sourceTemplate?.sha256, "Source identity SHA-256");
    assert(sourceSha256 === sourceIdentitySha, "Source identity SHA-256 differs from the entry SHA-256");
    const counterpartSha256 = validSha256(
      entry?.verifiedWindowCounterpart?.sha256,
      "Counterpart template SHA-256"
    );
    assert(sourceSha256 !== counterpartSha256, "Source and counterpart PDFs must be independently hashed");
    const sourcePath = safeRelativePath(
      entry?.sourceTemplate?.localRelativePath,
      "Source template path",
      "documents/source-pdfs/"
    );
    const counterpartPath = safeRelativePath(
      entry?.verifiedWindowCounterpart?.localRelativePath,
      "Counterpart template path",
      "documents/source-pdfs/"
    );
    const pairKey = `${sourceSha256}|${counterpartSha256}`;
    if (!groups.has(pairKey)) {
      groups.set(pairKey, {
        pairKey,
        sourceSha256,
        counterpartSha256,
        sourcePaths: new Set(),
        counterpartPaths: new Set(),
        entrySha256s: new Set(),
        geometryKeys: new Set(),
        finishKeys: new Set(),
        coveredBindingKeys: new Set(),
      });
    }
    const group = groups.get(pairKey);
    group.sourcePaths.add(sourcePath);
    group.counterpartPaths.add(counterpartPath);
    group.entrySha256s.add(sha256Json(entry));
    group.geometryKeys.add(geometryKey(entry.expectedGeometry));
    group.finishKeys.add(String(entry.finishKey || ""));
    for (const bindingKey of entry.coveredBindingKeys || []) {
      assert(typeof bindingKey === "string" && bindingKey !== "", "Covered binding key is invalid");
      group.coveredBindingKeys.add(bindingKey);
    }
  }

  return [...groups.values()]
    .sort((left, right) => left.pairKey.localeCompare(right.pairKey, "en"))
    .map((group, index) => {
      const sourcePaths = sortedUnique(group.sourcePaths);
      const counterpartPaths = sortedUnique(group.counterpartPaths);
      return {
        pairId: `pair-${String(index + 1).padStart(3, "0")}`,
        pairKey: group.pairKey,
        sourceSha256: group.sourceSha256,
        counterpartSha256: group.counterpartSha256,
        sourceRelativePath: sourcePaths[0],
        counterpartRelativePath: counterpartPaths[0],
        sourceReferencedPaths: sourcePaths,
        counterpartReferencedPaths: counterpartPaths,
        entrySha256s: sortedUnique(group.entrySha256s),
        geometryKeys: sortedUnique(group.geometryKeys),
        finishKeys: sortedUnique(group.finishKeys),
        coveredBindingKeys: sortedUnique(group.coveredBindingKeys),
      };
    });
}

async function defaultProcessRunner(command, args, { timeoutMs = 600_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new GeometryRenderReviewError(`Timed out running ${path.basename(command)}`)));
    }, timeoutMs);
    const capture = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > 8 * 1024 * 1024) {
        child.kill("SIGKILL");
        finish(() => reject(new GeometryRenderReviewError(`${path.basename(command)} output exceeded 8 MiB`)));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code !== 0) {
        reject(new GeometryRenderReviewError(
          `${path.basename(command)} exited ${code}: ${result.stderr.trim() || "no stderr"}`
        ));
        return;
      }
      resolve(result);
    }));
  });
}

async function regularPdf(runDirectory, relativePath, expectedSha256) {
  const absolutePath = pathWithin(runDirectory, relativePath, "Source PDF path");
  const stat = await fs.lstat(absolutePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `Source PDF is not a regular non-symlink file: ${relativePath}`);
  const realPath = await fs.realpath(absolutePath);
  const realRun = await fs.realpath(runDirectory);
  assert(realPath.startsWith(`${realRun}${path.sep}`), `Source PDF resolves outside the run directory: ${relativePath}`);
  const bytes = await fs.readFile(absolutePath);
  assert(bytes.subarray(0, 5).toString("ascii") === "%PDF-", `Source file is not a PDF: ${relativePath}`);
  const sha256 = sha256Bytes(bytes);
  assert(sha256 === expectedSha256, `Source PDF hash differs from supplement: ${relativePath}`);
  return { absolutePath, relativePath, sha256, bytes: bytes.length };
}

function portableArgs({ dpi, inputRelativePath, outputPrefix }) {
  return [
    "-png",
    "-r",
    String(dpi),
    `<run>/${inputRelativePath}`,
    `<output>/${outputPrefix}`,
  ];
}

async function renderPdf({
  rendererBinary,
  rendererVersion,
  processRunner,
  dpi,
  input,
  outputDirectory,
  outputPrefix,
}) {
  const absolutePrefix = path.join(outputDirectory, outputPrefix);
  const args = ["-png", "-r", String(dpi), input.absolutePath, absolutePrefix];
  const result = await processRunner(rendererBinary, args, { timeoutMs: 600_000 });
  const names = (await fs.readdir(outputDirectory))
    .filter((name) => name.startsWith(`${outputPrefix}-`) && name.endsWith(".png"))
    .map((name) => {
      const match = name.match(new RegExp(`^${outputPrefix}-(\\d+)\\.png$`));
      assert(match, `Renderer produced an unexpected filename: ${name}`);
      return { name, pageNumber: Number(match[1]) };
    })
    .sort((left, right) => left.pageNumber - right.pageNumber);
  assert(names.length > 0, `Renderer produced no PNG pages for ${input.relativePath}`);
  assert(
    names.every((item, index) => item.pageNumber === index + 1),
    `Renderer page sequence is incomplete for ${input.relativePath}`
  );

  const outputs = [];
  for (const item of names) {
    const absolutePath = path.join(outputDirectory, item.name);
    const stat = await fs.lstat(absolutePath);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Rendered page is not a regular file: ${item.name}`);
    const bytes = await fs.readFile(absolutePath);
    assert(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `Rendered page is not a PNG: ${item.name}`);
    outputs.push({
      pageNumber: item.pageNumber,
      relativePath: item.name,
      sha256: sha256Bytes(bytes),
      bytes: bytes.length,
    });
  }
  return {
    input: {
      relativePath: input.relativePath,
      sha256: input.sha256,
      bytes: input.bytes,
    },
    renderer: {
      tool: "pdftoppm",
      version: rendererVersion,
      args: portableArgs({ dpi, inputRelativePath: input.relativePath, outputPrefix }),
      pathPlaceholders: {
        "<run>": "the exact --run directory",
        "<output>": OUTPUT_PATH,
      },
      exitCode: result.code,
      stdoutSha256: sha256Bytes(Buffer.from(result.stdout, "utf8")),
      stderrSha256: sha256Bytes(Buffer.from(result.stderr, "utf8")),
    },
    outputs,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderImages(render, label) {
  return render.outputs.map((output) => `
    <figure>
      <img loading="lazy" src="${escapeHtml(output.relativePath)}" alt="${escapeHtml(label)} side ${output.pageNumber}">
      <figcaption>Side ${output.pageNumber} · ${escapeHtml(output.sha256)}</figcaption>
    </figure>`).join("");
}

export function buildReviewHtml(manifest) {
  const pairs = manifest.pairs.map((pair) => `
  <section class="pair" id="${escapeHtml(pair.pairId)}">
    <div class="pair-head">
      <div>
        <p class="eyebrow">${escapeHtml(pair.pairId)} · ${pair.entrySha256s.length} supplementposter · ${pair.coveredBindingCount} bindinger</p>
        <h2>${escapeHtml(pair.geometryKeys.join(" / "))}</h2>
        <p><strong>Efterbehandling:</strong> ${escapeHtml(pair.finishKeys.join(", ") || "Ikke angivet")}</p>
      </div>
      <div class="checklist" aria-label="Manuel kontrolliste">
        <span>□ Kilde uden vinduesudskæring</span>
        <span>□ Modstykke med vinduesudskæring</span>
        <span>□ Foldelinjer og øvrig geometri matcher</span>
      </div>
    </div>
    <div class="comparison">
      <article>
        <h3>Kilde: uden vindue</h3>
        <p class="hash">PDF SHA-256: ${escapeHtml(pair.sourceSha256)}</p>
        <p class="path">${escapeHtml(pair.sourceRender.input.relativePath)}</p>
        <div class="pages">${renderImages(pair.sourceRender, "Kilde uden vindue")}</div>
      </article>
      <article>
        <h3>Verificeret modstykke: med vindue</h3>
        <p class="hash">PDF SHA-256: ${escapeHtml(pair.counterpartSha256)}</p>
        <p class="path">${escapeHtml(pair.counterpartRender.input.relativePath)}</p>
        <div class="pages">${renderImages(pair.counterpartRender, "Modstykke med vindue")}</div>
      </article>
    </div>
  </section>`).join("\n");

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Salgsmapper · geometrisk renderkontrol</title>
  <style>
    :root { color-scheme: light; --blue: #075bb5; --ink: #172033; --muted: #667085; --line: #d7dee8; --soft: #f3f6fa; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: var(--ink); font: 15px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
    header, main { width: min(1500px, calc(100% - 40px)); margin: 0 auto; }
    header { padding: 42px 0 24px; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 10px; font-size: clamp(28px, 4vw, 46px); letter-spacing: -.035em; }
    h2 { margin-bottom: 8px; font-size: 22px; }
    h3 { margin-bottom: 8px; color: var(--blue); }
    .notice { border-left: 5px solid var(--blue); background: #eaf3ff; padding: 16px 18px; max-width: 1000px; }
    .summary { display: flex; flex-wrap: wrap; gap: 10px; margin: 20px 0 0; }
    .summary span { border: 1px solid var(--line); border-radius: 999px; padding: 7px 12px; background: #fff; }
    .pair { margin: 0 0 36px; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; break-inside: avoid; }
    .pair-head { display: flex; justify-content: space-between; gap: 24px; padding: 22px; background: var(--soft); border-bottom: 1px solid var(--line); }
    .eyebrow { margin-bottom: 6px; color: var(--blue); font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .checklist { display: grid; align-content: start; gap: 6px; min-width: 300px; font-weight: 650; }
    .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); }
    .comparison > article { min-width: 0; padding: 22px; background: #fff; }
    .hash, .path, figcaption { color: var(--muted); overflow-wrap: anywhere; }
    .hash { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .path { font-size: 12px; }
    .pages { display: grid; gap: 18px; }
    figure { margin: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; }
    img { display: block; width: 100%; height: auto; background: #fff; }
    figcaption { padding: 8px 10px; border-top: 1px solid var(--line); font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    footer { padding: 4px 0 42px; color: var(--muted); }
    @media (max-width: 900px) { .pair-head { display: block; } .checklist { margin-top: 18px; min-width: 0; } .comparison { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Kun lokalt kontrolmateriale</p>
    <h1>Salgsmapper · geometrisk renderkontrol</h1>
    <p class="notice"><strong>Afventer menneskelig kontrol.</strong> Denne side godkender intet, ændrer ikke supplementets status og ændrer ikke PDF-filerne. Billederne er rå visuelle beviser før Webprinter-sanitering.</p>
    <div class="summary">
      <span>${manifest.counts.uniquePairs} unikke PDF-par</span>
      <span>${manifest.counts.supplementEntries} supplementposter</span>
      <span>${manifest.counts.coveredBindingKeys} bindinger</span>
      <span>${escapeHtml(manifest.renderer.version)}</span>
      <span>${manifest.renderer.dpi} DPI · PNG</span>
    </div>
  </header>
  <main>${pairs}</main>
  <footer>Supplement SHA-256: ${escapeHtml(manifest.sourceSupplement.sha256)}</footer>
</body>
</html>
`;
}

async function atomicWrite(filePath, bytes) {
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

async function rendererVersion(rendererBinary, processRunner) {
  const result = await processRunner(rendererBinary, ["-v"], { timeoutMs: 30_000 });
  const lines = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  const version = lines.find((line) => /^pdftoppm version /iu.test(line));
  assert(version, "Could not read a pdftoppm version line");
  return { version, result };
}

export async function buildGeometryRenderReview({
  runDirectory,
  supplementRelativePath = DEFAULT_SUPPLEMENT_PATH,
  rendererBinary = "pdftoppm",
  dpi = 96,
  expectedPairs = null,
  processRunner = defaultProcessRunner,
}) {
  assert(runDirectory, "--run is required");
  assert(Number.isInteger(dpi) && dpi >= 72 && dpi <= 300, "DPI must be an integer from 72 to 300");
  assert(typeof processRunner === "function", "A process runner is required");
  if (expectedPairs !== null) assert(Number.isInteger(expectedPairs) && expectedPairs > 0, "Expected pair count is invalid");

  const resolvedRun = path.resolve(runDirectory);
  const runStat = await fs.lstat(resolvedRun);
  assert(runStat.isDirectory() && !runStat.isSymbolicLink(), "Run directory must be a real non-symlink directory");
  const realRun = await fs.realpath(resolvedRun);
  const reviewDirectory = pathWithin(resolvedRun, "review", "Review directory");
  const reviewStat = await fs.lstat(reviewDirectory);
  assert(reviewStat.isDirectory() && !reviewStat.isSymbolicLink(), "Review directory must be a real non-symlink directory");
  const realReview = await fs.realpath(reviewDirectory);
  assert(realReview.startsWith(`${realRun}${path.sep}`), "Review directory resolves outside the run directory");
  const supplementPath = pathWithin(
    resolvedRun,
    safeRelativePath(supplementRelativePath, "Supplement path", "review/"),
    "Supplement path"
  );
  const outputDirectory = pathWithin(resolvedRun, OUTPUT_PATH, "Render-review output path");
  const supplementStat = await fs.lstat(supplementPath);
  assert(supplementStat.isFile() && !supplementStat.isSymbolicLink(), "Supplement must be a regular non-symlink file");
  const realSupplementPath = await fs.realpath(supplementPath);
  assert(realSupplementPath.startsWith(`${realReview}${path.sep}`), "Supplement resolves outside the review directory");
  const supplementBytes = await fs.readFile(supplementPath);
  const supplementSha256 = sha256Bytes(supplementBytes);
  let supplement;
  try {
    supplement = JSON.parse(supplementBytes.toString("utf8"));
  } catch (error) {
    throw new GeometryRenderReviewError(`Cannot parse geometry supplement: ${error.message}`);
  }
  const pairs = collectUniqueRenderPairs(supplement);
  if (expectedPairs !== null) {
    assert(pairs.length === expectedPairs, `Expected ${expectedPairs} unique pairs, found ${pairs.length}`);
  }

  try {
    await fs.mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new GeometryRenderReviewError(`Render-review output already exists; refusing to overwrite: ${OUTPUT_PATH}`);
    }
    throw error;
  }

  let completed = false;
  try {
    const versionEvidence = await rendererVersion(rendererBinary, processRunner);
    const renderedPairs = [];
    for (const pair of pairs) {
      const sourceInput = await regularPdf(resolvedRun, pair.sourceRelativePath, pair.sourceSha256);
      const counterpartInput = await regularPdf(
        resolvedRun,
        pair.counterpartRelativePath,
        pair.counterpartSha256
      );
      const sourceRender = await renderPdf({
        rendererBinary,
        rendererVersion: versionEvidence.version,
        processRunner,
        dpi,
        input: sourceInput,
        outputDirectory,
        outputPrefix: `${pair.pairId}-source`,
      });
      const counterpartRender = await renderPdf({
        rendererBinary,
        rendererVersion: versionEvidence.version,
        processRunner,
        dpi,
        input: counterpartInput,
        outputDirectory,
        outputPrefix: `${pair.pairId}-counterpart`,
      });
      renderedPairs.push({
        ...pair,
        coveredBindingCount: pair.coveredBindingKeys.length,
        sourceRender,
        counterpartRender,
      });
    }

    const supplementBytesAfterRender = await fs.readFile(supplementPath);
    assert(
      sha256Bytes(supplementBytesAfterRender) === supplementSha256,
      "Geometry supplement changed during rendering"
    );
    const manifest = {
      kind: "wmd_sales_folder_geometry_render_review",
      schemaVersion: 1,
      reviewState: "pending_human_review",
      reviewDecision: {
        status: "not_recorded",
        reviewer: null,
        reviewedAt: null,
      },
      sourceSupplement: {
        relativePath: safeRelativePath(supplementRelativePath, "Supplement path", "review/"),
        sha256: supplementSha256,
        reviewState: supplement.reviewState,
      },
      generator: {
        script: SCRIPT_PATH,
        schemaVersion: 1,
      },
      renderer: {
        tool: "pdftoppm",
        executable: String(rendererBinary),
        version: versionEvidence.version,
        versionArgs: ["-v"],
        versionStdoutSha256: sha256Bytes(Buffer.from(versionEvidence.result.stdout, "utf8")),
        versionStderrSha256: sha256Bytes(Buffer.from(versionEvidence.result.stderr, "utf8")),
        dpi,
        format: "png",
      },
      counts: {
        supplementEntries: supplement.entries.length,
        uniquePairs: renderedPairs.length,
        uniqueSourcePdfs: new Set(renderedPairs.map((pair) => pair.sourceSha256)).size,
        uniqueCounterpartPdfs: new Set(renderedPairs.map((pair) => pair.counterpartSha256)).size,
        coveredBindingKeys: new Set(renderedPairs.flatMap((pair) => pair.coveredBindingKeys)).size,
        renderedPages: renderedPairs.reduce(
          (sum, pair) => sum + pair.sourceRender.outputs.length + pair.counterpartRender.outputs.length,
          0
        ),
      },
      pairs: renderedPairs,
      prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const htmlBytes = Buffer.from(buildReviewHtml(manifest), "utf8");
    await atomicWrite(path.join(outputDirectory, "render-manifest.json"), manifestBytes);
    await atomicWrite(path.join(outputDirectory, "index.html"), htmlBytes);

    const renderedOutputFiles = renderedPairs.flatMap((pair) => [
      ...pair.sourceRender.outputs,
      ...pair.counterpartRender.outputs,
    ]);
    const checksumEntries = [
      ...renderedOutputFiles.map((output) => ({ path: output.relativePath, sha256: output.sha256 })),
      { path: "index.html", sha256: sha256Bytes(htmlBytes) },
      { path: "render-manifest.json", sha256: sha256Bytes(manifestBytes) },
    ].sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
    const checksumsBytes = Buffer.from(
      `${checksumEntries.map((entry) => `${entry.sha256}  ${entry.path}`).join("\n")}\n`,
      "utf8"
    );
    await atomicWrite(path.join(outputDirectory, "checksums.sha256"), checksumsBytes);
    completed = true;
    return {
      outputDirectory,
      indexPath: path.join(outputDirectory, "index.html"),
      manifestPath: path.join(outputDirectory, "render-manifest.json"),
      manifestSha256: sha256Bytes(manifestBytes),
      checksumsSha256: sha256Bytes(checksumsBytes),
      counts: manifest.counts,
      reviewState: manifest.reviewState,
    };
  } finally {
    if (!completed) await fs.rm(outputDirectory, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = {
    runDirectory: null,
    supplementRelativePath: DEFAULT_SUPPLEMENT_PATH,
    rendererBinary: "pdftoppm",
    dpi: 96,
    expectedPairs: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--run") args.runDirectory = argv[++index];
    else if (item === "--supplement") args.supplementRelativePath = argv[++index];
    else if (item === "--pdftoppm") args.rendererBinary = argv[++index];
    else if (item === "--dpi") args.dpi = Number(argv[++index]);
    else if (item === "--expected-pairs") args.expectedPairs = Number(argv[++index]);
    else if (item === "--help") args.help = true;
    else throw new GeometryRenderReviewError(`Unknown argument: ${item}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node ${SCRIPT_PATH} --run <run-directory> [--supplement ${DEFAULT_SUPPLEMENT_PATH}] [--pdftoppm pdftoppm] [--dpi 96] [--expected-pairs 23]`);
    return;
  }
  const result = await buildGeometryRenderReview(args);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`REFUSED: ${error.message}`);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 2;
  });
}
