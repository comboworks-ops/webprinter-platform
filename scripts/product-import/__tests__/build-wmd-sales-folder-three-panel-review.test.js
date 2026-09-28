import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ThreePanelReviewError,
  buildThreePanelReview,
  collectThreePanelEvidence,
  sha256Bytes,
} from "../build-wmd-sales-folder-three-panel-review.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORMATS = [
  { key: "a4", label: "A4", width: 210, height: 297, dataWidth: 654, dataHeight: 367 },
  { key: "a5", label: "A5", width: 148, height: 210, dataWidth: 468, dataHeight: 270 },
  { key: "a6", label: "A6", width: 105, height: 148, dataWidth: 339, dataHeight: 200 },
];

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonLines(filePath, values) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${values.map((value) => JSON.stringify(value)).join("\n")}\n`);
}

async function makeFixture(root) {
  const runDirectory = path.join(root, "run");
  const repoRoot = path.join(root, "repo");
  const catalog = [];
  const stubs = [];
  const documents = [];
  const values = [];

  for (const format of FORMATS) {
    const modelKey = `${format.key}--3-part-1-flap`;
    const suffix = `mappe_din_${format.key}_3teilig_1lasche_1mm_40_2.pdf`;
    const pdfBytes = Buffer.from(`%PDF-1.7\n${modelKey}\n%%EOF\n`, "utf8");
    const pdfRelativePath = `documents/source-pdfs/${format.key}-${suffix}`;
    await fs.mkdir(path.dirname(path.join(runDirectory, pdfRelativePath)), { recursive: true });
    await fs.writeFile(path.join(runDirectory, pdfRelativePath), pdfBytes);

    const iconBytes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>`, "utf8");
    const iconRelativePath = `src/assets/product-options/sales-folders/models/v1/${modelKey}.svg`;
    await fs.mkdir(path.dirname(path.join(repoRoot, iconRelativePath)), { recursive: true });
    await fs.writeFile(path.join(repoRoot, iconRelativePath), iconBytes);

    catalog.push({
      classification: {
        formatKey: format.key,
        constructionKey: "3-part-1-flap",
        widthMm: format.width,
        heightMm: format.height,
      },
    });
    for (const print of ["4+0", "4+4"]) {
      stubs.push({
        match: {
          folder_model: modelKey,
          print,
          spine: print === "4+0" ? "1mm" : "3mm",
          paper: "chromo-mappekarton",
          finish: "none",
        },
        template: { sourceUrl: `https://supplier.invalid/${suffix}` },
        guide: { sourceUrl: `https://supplier.invalid/${suffix.replace("_2.pdf", "_1.pdf")}` },
      });
    }
    documents.push({
      sourceUrl: `https://supplier.invalid/${suffix}`,
      role: "template",
      localRelativePath: pdfRelativePath,
      sha256: sha256Bytes(pdfBytes),
      byteSize: pdfBytes.length,
      inspection: {
        pageCount: 2,
        pages: [1, 2].map((pageNumber) => ({
          pageNumber,
          size: { widthMm: format.dataWidth, heightMm: format.dataHeight },
        })),
      },
    });
    values.push({
      optionKey: modelKey,
      sourceAsset: {
        repoAssetPath: iconRelativePath,
        sha256: sha256Bytes(iconBytes),
      },
      proposedBackendSettingsAfterApprovedAssetResolution: {
        accessibleNameDa: `Illustration af ${format.label}, 3-delt mappe`,
      },
    });
  }

  await writeJson(path.join(runDirectory, "raw/catalog.json"), catalog);
  await writeJsonLines(path.join(runDirectory, "review/template-projection-stubs.jsonl"), stubs);
  await writeJsonLines(path.join(runDirectory, "documents/document-files.jsonl"), documents);
  await writeJson(path.join(runDirectory, "review/editable-option-image-settings.json"), { values });
  return { runDirectory, repoRoot, catalog, stubs, documents, iconSettings: { values } };
}

function fakePdftoppm() {
  const calls = [];
  const runner = async (command, args) => {
    calls.push({ command, args });
    if (args.length === 1 && args[0] === "-v") {
      return { code: 0, stdout: "", stderr: "pdftoppm version 99.1.0\n" };
    }
    assert.deepEqual(args.slice(0, 8), ["-png", "-r", "84", "-f", "1", "-l", "2", args[7]]);
    const outputPrefix = args.at(-1);
    for (const pageNumber of [1, 2]) {
      await fs.writeFile(
        `${outputPrefix}-${pageNumber}.png`,
        Buffer.concat([PNG_SIGNATURE, Buffer.from(`${path.basename(outputPrefix)}:${pageNumber}`)])
      );
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, runner };
}

test("three-panel evidence requires and summarizes A4, A5 and A6", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-three-panel-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const evidence = collectThreePanelEvidence(fixture);
  assert.deepEqual(evidence.counts, {
    models: 3,
    sourceProducts: 3,
    exactConfigurations: 6,
    templateUrls: 3,
    guideUrls: 3,
  });
  assert.deepEqual(evidence.models.map((model) => model.modelKey), [
    "a4--3-part-1-flap",
    "a5--3-part-1-flap",
    "a6--3-part-1-flap",
  ]);
  assert.deepEqual(evidence.models[0].printModes, ["4+0", "4+4"]);

  assert.throws(
    () => collectThreePanelEvidence({ ...fixture, catalog: fixture.catalog.slice(1) }),
    (error) => error instanceof ThreePanelReviewError && /a4--3-part-1-flap mangler/.test(error.message)
  );
});

test("review pack renders both raw PDF pages, uses copied Webprinter icons and stays local only", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-three-panel-review-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const fake = fakePdftoppm();
  const result = await buildThreePanelReview({
    runDirectory: fixture.runDirectory,
    repoRoot: fixture.repoRoot,
    rendererBinary: "fake-pdftoppm",
    processRunner: fake.runner,
  });

  assert.equal(fake.calls.length, 4);
  assert.deepEqual(result.counts, {
    models: 3,
    sourceProducts: 3,
    exactConfigurations: 6,
    templateUrls: 3,
    guideUrls: 3,
  });
  const html = await fs.readFile(result.indexPath, "utf8");
  const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
  assert.match(html, /Ja – de 3-delte salgsmapper er med/);
  assert.match(html, /viser kun de 23 særlige A4-par/);
  assert.match(html, /\.\.\/storefront-proposal\.html/);
  assert.match(html, /\.\.\/template-geometry-render-review\/index\.html/);
  assert.equal((html.match(/Bekræftet 3-delt konstruktion/g) || []).length, 3);
  assert.equal(manifest.state, "local_geometry_evidence_only");
  assert.equal(manifest.models.length, 3);
  assert.ok(manifest.models.every((model) => model.renders.length === 2));
  assert.deepEqual(manifest.prohibitedActionsPerformed, {
    sourcePdfModified: false,
    sourcePdfSanitized: false,
    databaseWritten: false,
    storageWritten: false,
    productWritten: false,
    pricingWritten: false,
    published: false,
  });
  assert.match(await fs.readFile(path.join(result.outputDirectory, "checksums.sha256"), "utf8"), /a4-three-panel-1\.png/);
});

test("review pack refuses to overwrite an existing review directory", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-three-panel-overwrite-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  await fs.mkdir(path.join(fixture.runDirectory, "review/three-panel-folder-review"));
  await assert.rejects(
    buildThreePanelReview({
      runDirectory: fixture.runDirectory,
      repoRoot: fixture.repoRoot,
      processRunner: fakePdftoppm().runner,
    }),
    /afviser at overskrive/
  );
});
