#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = "scripts/product-import/build-wmd-sales-folder-three-panel-review.js";
const OUTPUT_RELATIVE_PATH = "review/three-panel-folder-review";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MODEL_SPECS = Object.freeze([
  {
    modelKey: "a4--3-part-1-flap",
    formatKey: "a4",
    formatLabel: "A4",
    finishedWidthMm: 210,
    finishedHeightMm: 297,
    representativeTemplateSuffix: "mappe_din_a4_3teilig_1lasche_1mm_40_2.pdf",
  },
  {
    modelKey: "a5--3-part-1-flap",
    formatKey: "a5",
    formatLabel: "A5",
    finishedWidthMm: 148,
    finishedHeightMm: 210,
    representativeTemplateSuffix: "mappe_din_a5_3teilig_1lasche_1mm_40_2.pdf",
  },
  {
    modelKey: "a6--3-part-1-flap",
    formatKey: "a6",
    formatLabel: "A6",
    finishedWidthMm: 105,
    finishedHeightMm: 148,
    representativeTemplateSuffix: "mappe_din_a6_3teilig_1lasche_1mm_40_2.pdf",
  },
]);

const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  databaseWritten: false,
  storageWritten: false,
  productWritten: false,
  pricingWritten: false,
  published: false,
});

export class ThreePanelReviewError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ThreePanelReviewError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new ThreePanelReviewError(message, details);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) =>
    String(left).localeCompare(String(right), "da", { numeric: true })
  );
}

function validRelativePath(value, label, requiredPrefix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized !== "", `${label} mangler`);
  assert(!path.posix.isAbsolute(normalized), `${label} skal være relativ`);
  assert(!normalized.split("/").includes(".."), `${label} må ikke forlade den tilladte mappe`);
  if (requiredPrefix) assert(normalized.startsWith(requiredPrefix), `${label} skal starte med ${requiredPrefix}`);
  return normalized;
}

function pathWithin(root, relativePath, label) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  assert(resolved.startsWith(`${resolvedRoot}${path.sep}`), `${label} forlader sin tilladte mappe`);
  return resolved;
}

async function readJson(filePath, label) {
  const bytes = await fs.readFile(filePath);
  try {
    return { value: JSON.parse(bytes.toString("utf8")), bytes };
  } catch (error) {
    throw new ThreePanelReviewError(`${label} kan ikke læses som JSON: ${error.message}`);
  }
}

async function readJsonLines(filePath, label) {
  const bytes = await fs.readFile(filePath);
  const rows = [];
  for (const [index, line] of bytes.toString("utf8").split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new ThreePanelReviewError(`${label} linje ${index + 1} er ugyldig JSON: ${error.message}`);
    }
  }
  return { value: rows, bytes };
}

async function regularFileInside(root, relativePath, label) {
  const normalized = validRelativePath(relativePath, label);
  const absolutePath = pathWithin(root, normalized, label);
  const stat = await fs.lstat(absolutePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} er ikke en almindelig fil: ${normalized}`);
  const realRoot = await fs.realpath(root);
  const realPath = await fs.realpath(absolutePath);
  assert(realPath.startsWith(`${realRoot}${path.sep}`), `${label} peger uden for sin tilladte mappe`);
  const bytes = await fs.readFile(absolutePath);
  return { absolutePath, relativePath: normalized, bytes, sha256: sha256Bytes(bytes) };
}

function roundMillimetres(value) {
  const number = Number(value);
  assert(Number.isFinite(number) && number > 0, "Skabelonens sidemål mangler");
  return Math.round(number * 10) / 10;
}

function modelLabel(formatLabel) {
  return `${formatLabel} · 3-delt med 1 flap`;
}

export function collectThreePanelEvidence({ catalog, stubs, documents, iconSettings }) {
  assert(Array.isArray(catalog), "Leverandørkataloget skal være en liste");
  assert(Array.isArray(stubs), "Skabelonbindingerne skal være en liste");
  assert(Array.isArray(documents), "Dokumentoversigten skal være en liste");
  assert(Array.isArray(iconSettings?.values), "Ikonindstillingerne mangler værdier");

  const models = MODEL_SPECS.map((spec) => {
    const products = catalog.filter((product) =>
      product?.classification?.formatKey === spec.formatKey &&
      product?.classification?.constructionKey === "3-part-1-flap"
    );
    const modelStubs = stubs.filter((stub) => stub?.match?.folder_model === spec.modelKey);
    const representativeDocument = documents.find((document) =>
      document?.role === "template" &&
      String(document?.sourceUrl || "").endsWith(spec.representativeTemplateSuffix)
    );
    const icon = iconSettings.values.find((value) => value?.optionKey === spec.modelKey);

    assert(products.length > 0, `${spec.modelKey} mangler i leverandørkataloget`);
    assert(modelStubs.length > 0, `${spec.modelKey} mangler i de foreslåede skabelonbindinger`);
    assert(representativeDocument, `${spec.modelKey} mangler sin repræsentative rå skabelon`);
    assert(icon?.sourceAsset?.repoAssetPath, `${spec.modelKey} mangler sit Webprinter-ikon`);
    assert(representativeDocument?.inspection?.pageCount === 2, `${spec.modelKey} skal have præcis to PDF-sider`);
    assert(Array.isArray(representativeDocument?.inspection?.pages), `${spec.modelKey} mangler sidemål`);
    assert(representativeDocument.inspection.pages.length === 2, `${spec.modelKey} mangler sidemål for begge sider`);
    assert(SHA256_PATTERN.test(String(representativeDocument.sha256 || "")), `${spec.modelKey} har ugyldig PDF-hash`);
    assert(SHA256_PATTERN.test(String(icon.sourceAsset.sha256 || "")), `${spec.modelKey} har ugyldig ikon-hash`);

    const firstPage = representativeDocument.inspection.pages[0];
    return {
      ...spec,
      labelDa: modelLabel(spec.formatLabel),
      descriptionDa: "Tre fuldhøjde paneler adskilt af falselinjer samt én bundflap.",
      sourceProductCount: products.length,
      exactConfigurationCount: modelStubs.length,
      printModes: sortedUnique(modelStubs.map((stub) => stub.match.print)),
      spineDepths: sortedUnique(modelStubs.map((stub) => stub.match.spine)),
      paperCount: new Set(modelStubs.map((stub) => stub.match.paper)).size,
      finishCount: new Set(modelStubs.map((stub) => stub.match.finish)).size,
      templateUrlCount: new Set(modelStubs.map((stub) => stub.template?.sourceUrl).filter(Boolean)).size,
      guideUrlCount: new Set(modelStubs.map((stub) => stub.guide?.sourceUrl).filter(Boolean)).size,
      dataWidthMm: roundMillimetres(firstPage?.size?.widthMm),
      dataHeightMm: roundMillimetres(firstPage?.size?.heightMm),
      sourcePdf: {
        sourceUrl: representativeDocument.sourceUrl,
        relativePath: validRelativePath(
          representativeDocument.localRelativePath,
          `${spec.modelKey} PDF-sti`,
          "documents/source-pdfs/"
        ),
        sha256: representativeDocument.sha256,
        byteSize: representativeDocument.byteSize,
        pageCount: representativeDocument.inspection.pageCount,
      },
      icon: {
        repoAssetPath: validRelativePath(
          icon.sourceAsset.repoAssetPath,
          `${spec.modelKey} ikon-sti`,
          "src/assets/product-options/sales-folders/models/"
        ),
        sha256: icon.sourceAsset.sha256,
        accessibleNameDa:
          icon.proposedBackendSettingsAfterApprovedAssetResolution?.accessibleNameDa ||
          `Illustration af ${modelLabel(spec.formatLabel)}`,
      },
    };
  });

  return {
    models,
    counts: {
      models: models.length,
      sourceProducts: models.reduce((sum, model) => sum + model.sourceProductCount, 0),
      exactConfigurations: models.reduce((sum, model) => sum + model.exactConfigurationCount, 0),
      templateUrls: models.reduce((sum, model) => sum + model.templateUrlCount, 0),
      guideUrls: models.reduce((sum, model) => sum + model.guideUrlCount, 0),
    },
  };
}

async function defaultProcessRunner(command, args, { timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new ThreePanelReviewError(`Timeout ved kørsel af ${path.basename(command)}`)));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => {
      const result = {
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code !== 0) {
        reject(new ThreePanelReviewError(
          `${path.basename(command)} sluttede med kode ${code}: ${result.stderr.trim() || "ingen fejltekst"}`
        ));
        return;
      }
      resolve(result);
    }));
  });
}

async function readRendererVersion(rendererBinary, processRunner) {
  const result = await processRunner(rendererBinary, ["-v"], { timeoutMs: 30_000 });
  const version = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^pdftoppm version /iu.test(line));
  assert(version, "pdftoppm-versionen kunne ikke aflæses");
  return version;
}

async function renderTwoPages({ rendererBinary, processRunner, dpi, sourcePdf, outputDirectory, outputPrefix }) {
  const outputPrefixPath = path.join(outputDirectory, outputPrefix);
  await processRunner(
    rendererBinary,
    ["-png", "-r", String(dpi), "-f", "1", "-l", "2", sourcePdf.absolutePath, outputPrefixPath],
    { timeoutMs: 180_000 }
  );
  const outputs = [];
  for (const pageNumber of [1, 2]) {
    const name = `${outputPrefix}-${pageNumber}.png`;
    const file = await regularFileInside(outputDirectory, name, `Renderet side ${pageNumber}`);
    assert(file.bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `${name} er ikke en PNG-fil`);
    outputs.push({
      pageNumber,
      relativePath: name,
      sha256: file.sha256,
      byteSize: file.bytes.length,
    });
  }
  return outputs;
}

function chipList(values) {
  return values.map((value) => `<span>${escapeHtml(value)}</span>`).join("");
}

function modelCard(model) {
  const pdfLink = `../../${model.sourcePdf.relativePath}`;
  const renders = model.renders.map((render) => {
    const sideLabel = render.pageNumber === 1 ? "Yderside" : "Inderside";
    return `
          <figure>
            <div class="figure-head">
              <strong>${sideLabel}</strong>
              <span>Rå kilde · side ${render.pageNumber}</span>
            </div>
            <img src="${escapeHtml(render.relativePath)}" alt="${escapeHtml(model.labelDa)}, ${sideLabel.toLowerCase()}, rå PDF-rendering">
          </figure>`;
  }).join("");

  return `
    <section class="model" id="${escapeHtml(model.formatKey)}">
      <div class="model-copy">
        <div class="model-heading">
          <span class="icon-wrap"><img src="${escapeHtml(model.icon.outputRelativePath)}" alt="${escapeHtml(model.icon.accessibleNameDa)}"></span>
          <div>
            <p class="eyebrow">Bekræftet 3-delt konstruktion</p>
            <h2>${escapeHtml(model.labelDa)}</h2>
            <p>${escapeHtml(model.descriptionDa)}</p>
          </div>
        </div>
        <dl class="facts">
          <div><dt>Færdigt format</dt><dd>${model.finishedWidthMm} × ${model.finishedHeightMm} mm</dd></div>
          <div><dt>Rå skabelonflade</dt><dd>${model.dataWidthMm} × ${model.dataHeightMm} mm</dd></div>
          <div><dt>Kildeprodukter</dt><dd>${model.sourceProductCount}</dd></div>
          <div><dt>Præcise kombinationer</dt><dd>${model.exactConfigurationCount}</dd></div>
          <div><dt>Trykskabeloner</dt><dd>${model.templateUrlCount}</dd></div>
          <div><dt>Datablade</dt><dd>${model.guideUrlCount}</dd></div>
        </dl>
        <div class="choice-row"><strong>Tryk</strong><div class="chips">${chipList(model.printModes)}</div></div>
        <div class="choice-row"><strong>Ryg</strong><div class="chips">${chipList(model.spineDepths)}</div></div>
        <div class="choice-row"><strong>Sortiment</strong><div class="chips"><span>${model.paperCount} kartontyper</span><span>${model.finishCount} efterbehandlinger</span></div></div>
        <a class="text-link" href="${escapeHtml(pdfLink)}" target="_blank" rel="noopener">Åbn den repræsentative rå PDF</a>
      </div>
      <div class="renders">${renders}</div>
    </section>`;
}

export function buildThreePanelHtml(manifest) {
  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>3-delte salgsmapper · lokal kontrol</title>
  <style>
    :root { color-scheme: light; --blue: #0ea5e9; --blue-dark: #0284c7; --ink: #102033; --muted: #64748b; --line: #dbe6ef; --soft: #f4f9fc; --white: #fff; }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; color: var(--ink); background: var(--white); font: 15px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: inherit; }
    img { display: block; max-width: 100%; }
    h1, h2, p { margin-top: 0; }
    header, main, footer { width: min(1500px, calc(100% - 40px)); margin-inline: auto; }
    header { padding: 42px 0 30px; }
    .eyebrow { margin-bottom: 8px; color: var(--blue-dark); font-size: 12px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
    h1 { max-width: 850px; margin-bottom: 14px; font-size: clamp(34px, 5vw, 64px); line-height: 1.02; letter-spacing: -.045em; }
    h2 { margin-bottom: 7px; font-size: clamp(25px, 3vw, 36px); letter-spacing: -.035em; }
    .lead { max-width: 930px; color: #34485c; font-size: 18px; }
    .notice { margin-top: 24px; max-width: 1050px; padding: 18px 20px; border: 1px solid #bfe6f8; border-left: 5px solid var(--blue); border-radius: 12px; background: #effaff; }
    .notice p:last-child { margin-bottom: 0; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 24px; }
    .summary div { padding: 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--white); }
    .summary strong { display: block; color: var(--blue-dark); font-size: 30px; line-height: 1; }
    .summary span { display: block; margin-top: 7px; color: var(--muted); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    .button { display: inline-flex; min-height: 44px; align-items: center; padding: 10px 15px; border: 1px solid var(--line); border-radius: 10px; background: var(--white); text-decoration: none; font-weight: 750; }
    .button.primary { border-color: var(--blue-dark); color: #fff; background: var(--blue-dark); }
    .model { display: grid; grid-template-columns: minmax(320px, .74fr) minmax(0, 1.7fr); gap: 24px; margin-bottom: 30px; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: var(--white); box-shadow: 0 16px 44px rgba(15, 56, 82, .07); scroll-margin-top: 20px; }
    .model-copy { min-width: 0; }
    .model-heading { display: grid; grid-template-columns: 104px 1fr; gap: 18px; align-items: center; }
    .icon-wrap { display: grid; width: 104px; height: 104px; place-items: center; border: 1px solid var(--line); border-radius: 16px; background: var(--white); }
    .icon-wrap img { width: 84px; height: 84px; object-fit: contain; }
    .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 22px 0; overflow: hidden; border: 1px solid var(--line); border-radius: 13px; background: var(--line); }
    .facts div { padding: 12px 13px; background: var(--white); }
    dt { color: var(--muted); font-size: 12px; font-weight: 700; }
    dd { margin: 2px 0 0; font-size: 16px; font-weight: 800; }
    .choice-row { display: grid; grid-template-columns: 76px 1fr; gap: 10px; align-items: start; margin: 12px 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 7px; }
    .chips span { padding: 5px 9px; border: 1px solid #bae6fd; border-radius: 999px; color: #075985; background: #f0f9ff; font-size: 12px; font-weight: 760; }
    .text-link { display: inline-block; margin-top: 12px; color: var(--blue-dark); font-weight: 760; text-underline-offset: 3px; }
    .renders { display: grid; gap: 16px; min-width: 0; }
    figure { margin: 0; overflow: hidden; border: 1px solid var(--line); border-radius: 15px; background: var(--white); }
    .figure-head { display: flex; justify-content: space-between; gap: 12px; padding: 10px 13px; border-bottom: 1px solid var(--line); background: var(--soft); }
    .figure-head span { color: var(--muted); font-size: 12px; }
    figure > img { width: 100%; height: auto; background: var(--white); }
    footer { padding: 8px 0 46px; color: var(--muted); font-size: 13px; }
    @media (max-width: 980px) { .summary { grid-template-columns: repeat(2, 1fr); } .model { grid-template-columns: 1fr; } }
    @media (max-width: 560px) { header, main, footer { width: min(100% - 24px, 1500px); } .summary { grid-template-columns: 1fr 1fr; } .model { padding: 16px; } .model-heading { grid-template-columns: 76px 1fr; } .icon-wrap { width: 76px; height: 76px; } .icon-wrap img { width: 62px; height: 62px; } .facts { grid-template-columns: 1fr; } .choice-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Lokal produktkontrol · Webprinter</p>
    <h1>Ja – de 3-delte salgsmapper er med.</h1>
    <p class="lead">Her kan du se A4, A5 og A6 åbnet helt ud. Hver model har tre store paneler i fuld højde og én bundflap.</p>
    <div class="notice">
      <p><strong>Hvorfor var de ikke synlige på den forrige side?</strong></p>
      <p>Siden <em>template-geometry-render-review</em> viser kun de 23 særlige A4-par, hvor en leverandørtitel og selve vinduesgeometrien skulle sammenlignes. Den er ikke en oversigt over hele sortimentet.</p>
      <p><strong>Vigtigt om billederne her:</strong> De er rå leverandør-PDF'er, som kun bruges som geometrisk dokumentation. De er ikke kundernes færdige filer. Før designer/import skal grønne informationsfelter erstattes med Webprinter-blå, teksten oversættes til dansk, leverandørmetadata fjernes, og den fravalgte CD-lomme fjernes.</p>
    </div>
    <div class="summary" aria-label="Samlet dækning">
      <div><strong>${manifest.counts.models}</strong><span>3-delte modeller</span></div>
      <div><strong>${manifest.counts.sourceProducts}</strong><span>leverandørkonfiguratorer</span></div>
      <div><strong>${manifest.counts.exactConfigurations}</strong><span>præcise kombinationer</span></div>
      <div><strong>${manifest.counts.templateUrls}</strong><span>tryksskabeloner</span></div>
    </div>
    <nav class="actions" aria-label="Kontrolnavigation">
      <a class="button primary" href="../storefront-proposal.html">Til samlet produktforslag</a>
      <a class="button" href="../template-geometry-render-review/index.html">Til siden med geometri-undtagelser</a>
      ${manifest.models.map((model) => `<a class="button" href="#${escapeHtml(model.formatKey)}">Se ${escapeHtml(model.formatLabel)}</a>`).join("\n      ")}
    </nav>
  </header>
  <main>${manifest.models.map(modelCard).join("\n")}</main>
  <footer>Kun lokal, skrivebeskyttet gennemgang. Ingen database-, lager-, produkt-, pris- eller publiceringsændringer er udført. Renderet med ${escapeHtml(manifest.renderer.version)} ved ${manifest.renderer.dpi} DPI.</footer>
</body>
</html>
`;
}

async function atomicWrite(filePath, bytes) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

export async function buildThreePanelReview({
  runDirectory,
  repoRoot = process.cwd(),
  rendererBinary = "pdftoppm",
  dpi = 84,
  processRunner = defaultProcessRunner,
}) {
  assert(runDirectory, "--run er påkrævet");
  assert(Number.isInteger(dpi) && dpi >= 72 && dpi <= 200, "DPI skal være et heltal mellem 72 og 200");
  assert(typeof processRunner === "function", "En process runner er påkrævet");

  const resolvedRun = path.resolve(runDirectory);
  const resolvedRepo = path.resolve(repoRoot);
  const runStat = await fs.lstat(resolvedRun);
  const repoStat = await fs.lstat(resolvedRepo);
  assert(runStat.isDirectory() && !runStat.isSymbolicLink(), "Run-mappen skal være en almindelig mappe");
  assert(repoStat.isDirectory() && !repoStat.isSymbolicLink(), "Repo-roden skal være en almindelig mappe");

  const sources = {
    catalog: "raw/catalog.json",
    stubs: "review/template-projection-stubs.jsonl",
    documents: "documents/document-files.jsonl",
    iconSettings: "review/editable-option-image-settings.json",
  };
  const catalog = await readJson(pathWithin(resolvedRun, sources.catalog, "Katalog"), "Katalog");
  const stubs = await readJsonLines(pathWithin(resolvedRun, sources.stubs, "Skabelonbindinger"), "Skabelonbindinger");
  const documents = await readJsonLines(pathWithin(resolvedRun, sources.documents, "Dokumentoversigt"), "Dokumentoversigt");
  const iconSettings = await readJson(pathWithin(resolvedRun, sources.iconSettings, "Ikonindstillinger"), "Ikonindstillinger");
  const evidence = collectThreePanelEvidence({
    catalog: catalog.value,
    stubs: stubs.value,
    documents: documents.value,
    iconSettings: iconSettings.value,
  });

  const outputDirectory = pathWithin(resolvedRun, OUTPUT_RELATIVE_PATH, "Outputmappe");
  try {
    await fs.mkdir(outputDirectory, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new ThreePanelReviewError(`Output findes allerede; afviser at overskrive: ${OUTPUT_RELATIVE_PATH}`);
    }
    throw error;
  }

  let completed = false;
  try {
    const rendererVersion = await readRendererVersion(rendererBinary, processRunner);
    const models = [];
    for (const model of evidence.models) {
      const sourcePdf = await regularFileInside(resolvedRun, model.sourcePdf.relativePath, `${model.modelKey} PDF`);
      assert(sourcePdf.bytes.subarray(0, 5).toString("ascii") === "%PDF-", `${model.modelKey} kildefil er ikke en PDF`);
      assert(sourcePdf.sha256 === model.sourcePdf.sha256, `${model.modelKey} PDF-hash afviger fra dokumentoversigten`);

      const sourceIcon = await regularFileInside(resolvedRepo, model.icon.repoAssetPath, `${model.modelKey} ikon`);
      assert(sourceIcon.sha256 === model.icon.sha256, `${model.modelKey} ikon-hash afviger fra manifestet`);
      const iconName = `${model.modelKey}.svg`;
      await fs.writeFile(path.join(outputDirectory, iconName), sourceIcon.bytes, { flag: "wx", mode: 0o600 });

      const outputPrefix = `${model.formatKey}-three-panel`;
      const renders = await renderTwoPages({
        rendererBinary,
        processRunner,
        dpi,
        sourcePdf,
        outputDirectory,
        outputPrefix,
      });
      models.push({
        ...model,
        sourcePdf: {
          ...model.sourcePdf,
          verifiedSha256: sourcePdf.sha256,
        },
        icon: {
          ...model.icon,
          outputRelativePath: iconName,
          copiedSha256: sourceIcon.sha256,
        },
        renders,
      });
    }

    const manifest = {
      kind: "wmd_sales_folder_three_panel_review",
      schemaVersion: 1,
      state: "local_geometry_evidence_only",
      explanationDa: "Den eksisterende template-geometry-render-review viser kun særlige geometri-undtagelser og er ikke en katalogoversigt.",
      inputs: Object.fromEntries(Object.entries(sources).map(([key, relativePath]) => [key, {
        relativePath,
        sha256: sha256Bytes(
          key === "catalog" ? catalog.bytes :
          key === "stubs" ? stubs.bytes :
          key === "documents" ? documents.bytes :
          iconSettings.bytes
        ),
      }])),
      generator: { script: SCRIPT_PATH, schemaVersion: 1 },
      renderer: { tool: "pdftoppm", version: rendererVersion, dpi, format: "png" },
      counts: evidence.counts,
      models,
      prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const htmlBytes = Buffer.from(buildThreePanelHtml(manifest), "utf8");
    await atomicWrite(path.join(outputDirectory, "review-manifest.json"), manifestBytes);
    await atomicWrite(path.join(outputDirectory, "index.html"), htmlBytes);

    const checksumPaths = [
      "index.html",
      "review-manifest.json",
      ...models.flatMap((model) => [model.icon.outputRelativePath, ...model.renders.map((render) => render.relativePath)]),
    ].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    const checksumLines = [];
    for (const relativePath of checksumPaths) {
      const bytes = await fs.readFile(path.join(outputDirectory, relativePath));
      checksumLines.push(`${sha256Bytes(bytes)}  ${relativePath}`);
    }
    await atomicWrite(path.join(outputDirectory, "checksums.sha256"), Buffer.from(`${checksumLines.join("\n")}\n`, "utf8"));
    completed = true;
    return {
      outputDirectory,
      indexPath: path.join(outputDirectory, "index.html"),
      manifestPath: path.join(outputDirectory, "review-manifest.json"),
      counts: evidence.counts,
    };
  } finally {
    if (!completed) await fs.rm(outputDirectory, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = { runDirectory: null, repoRoot: process.cwd(), rendererBinary: "pdftoppm", dpi: 84 };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--run") args.runDirectory = argv[++index];
    else if (item === "--repo-root") args.repoRoot = argv[++index];
    else if (item === "--renderer") args.rendererBinary = argv[++index];
    else if (item === "--dpi") args.dpi = Number(argv[++index]);
    else throw new ThreePanelReviewError(`Ukendt argument: ${item}`);
  }
  return args;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  buildThreePanelReview(parseArgs(process.argv.slice(2)))
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.name}: ${error.message}\n`);
      if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
      process.exitCode = 1;
    });
}
