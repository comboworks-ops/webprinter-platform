import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  SalesFolderStorefrontProposalError,
  buildStorefrontDataset,
  buildStorefrontProposal,
  renderStorefrontProposalHtml,
  resolveClosestExactCombination,
} from "../build-wmd-sales-folder-storefront-proposal.js";

const AXES = ["folder_model", "print", "spine", "paper", "finish"];
const MODEL_KEYS = Array.from({ length: 21 }, (_, index) => `model-${String(index + 1).padStart(2, "0")}`);

function selectionKey(selection) {
  return AXES.map((axis) => `${axis}=${encodeURIComponent(selection[axis])}`).join("|");
}

function optionGroup(key, values) {
  return {
    key,
    labelDa: {
      folder_model: "Mappemodel",
      print: "Tryk",
      spine: "Rygbredde",
      paper: "Papir og karton",
      finish: "Efterbehandling",
    }[key],
    values: values.map((value, sourceOrder) => ({ ...value, sourceOrder })),
  };
}

function fixture() {
  const models = MODEL_KEYS.map((key, index) => ({
    key,
    labelDa: `Testmodel ${index + 1}`,
    widthMm: 210,
    heightMm: 297,
    icon: {
      accessibleNameDa: `Illustration af testmodel ${index + 1}`,
      svg: { repoAssetPath: `assets/${key}.svg` },
    },
  }));
  const print = [
    { key: "4+0", labelDa: "4+0 – tryk på ydersiden" },
    { key: "4+4", labelDa: "4+4 – tryk på yder- og indersiden" },
  ];
  const spine = [1, 3, 5, 10].map((value) => ({ key: `${value}mm`, labelDa: `${value} mm ryg` }));
  const paper = [
    ["chromo-mappekarton", "255g Chromo mappekarton"],
    ["matt-billedtrykskarton", "350g Mat billedtrykskarton"],
    ["hoejhvid-naturkarton", "300g Højhvid naturkarton"],
    ["hvid-genbrugskarton", "300g Hvid genbrugskarton"],
  ].map(([key, labelDa]) => ({ key, labelDa }));
  const finish = [
    ["none", "Ingen efterbehandling"],
    ["high-gloss-uv", "Højglans UV-lak"],
    ["partial-uv", "Partiel UV-lak"],
    ["matt-lamination", "Mat laminering"],
    ["gloss-lamination", "Blank laminering"],
    ["soft-touch-lamination", "Soft-touch-laminering"],
    ["soft-touch-partial-uv", "Soft-touch-laminering + partiel UV-lak"],
    ["hot-foil-gold", "Guldfoliepræg"],
    ["hot-foil-silver", "Sølvfoliepræg"],
    ["blind-emboss", "Blindpræg"],
  ].map(([key, labelDa]) => ({ key, labelDa }));
  const proposal = {
    schemaVersion: 1,
    state: "local_review_only",
    status: {
      productCreated: false,
      pricesWritten: false,
      templatesWritten: false,
      published: false,
      eligibleForImport: false,
    },
    axisOrder: [...AXES],
    proposedProduct: {
      slug: "salgsmapper-med-eget-design",
      nameDa: "Salgsmapper med eget design",
      isPublished: false,
      shortDescriptionDa: "Vælg kun dokumenterede mapper og priser.",
      aboutTitleDa: "Salgsmapper til præsentationer",
      aboutDescriptionDa: "Et lokalt review af den samlede konfiguration.",
    },
    optionGroups: [
      optionGroup("folder_model", models),
      optionGroup("print", print),
      optionGroup("spine", spine),
      optionGroup("paper", paper),
      optionGroup("finish", finish),
    ],
    visualAssets: {
      productHero: {
        repoAssetPath: "assets/hero.png",
        published: false,
      },
    },
  };

  const selections = MODEL_KEYS.map((modelKey, index) => ({
    folder_model: modelKey,
    print: index === 1 ? "4+4" : "4+0",
    spine: ["1mm", "3mm", "5mm", "10mm"][index % 4],
    paper: paper[index % paper.length].key,
    finish: finish[index % finish.length].key,
  }));
  selections.push({
    folder_model: MODEL_KEYS[0],
    print: "4+4",
    spine: "3mm",
    paper: "matt-billedtrykskarton",
    finish: "partial-uv",
  });
  const compatibility = {
    schemaVersion: 1,
    sparse: true,
    interpolationAllowed: false,
    combinations: selections.map((selections, index) => ({
      selectionKey: selectionKey(selections),
      selections,
      quantities: index === 0 ? [50, 100, 250] : [100],
    })),
  };
  const priceRows = compatibility.combinations.flatMap((combination, combinationIndex) =>
    combination.quantities.map((quantity, quantityIndex) => ({
      proposedSelectionKey: `${combination.selectionKey}|quantity=${quantity}`,
      selections: combination.selections,
      quantity,
      finalPriceDkk: 300 + combinationIndex * 10 + quantityIndex,
      noInterpolation: true,
    }))
  );
  const assetHrefs = Object.fromEntries([
    ["assets/hero.png", "../../../../assets/hero.png"],
    ...MODEL_KEYS.map((key) => [`assets/${key}.svg`, `../../../../assets/${key}.svg`]),
  ]);
  return { proposal, compatibility, priceRows, assetHrefs };
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

test("builds all 21 model tiles in source order with exact sparse prices and finish artwork modes", () => {
  const data = fixture();
  const dataset = buildStorefrontDataset(data);
  assert.equal(dataset.state, "local_review_only");
  assert.equal(dataset.mutationBoundary.databaseWrites, false);
  assert.equal(dataset.mutationBoundary.published, false);
  assert.equal(dataset.optionGroups.folder_model.values.length, 21);
  assert.deepEqual(dataset.optionGroups.folder_model.values.map((value) => value.key), MODEL_KEYS);
  assert.deepEqual(dataset.optionGroups.print.values.map((value) => value.key), ["4+0", "4+4"]);
  assert.deepEqual(dataset.optionGroups.spine.values.map((value) => value.key), ["1mm", "3mm", "5mm", "10mm"]);
  assert.equal(dataset.combinationCount, 22);
  assert.equal(dataset.priceRowCount, 24);
  assert.deepEqual(dataset.combinations[0][5], [[50, 300], [100, 301], [250, 302]]);
  assert.equal(
    dataset.optionGroups.finish.values.find((value) => value.key === "matt-lamination").artworkMode,
    "online_designer"
  );
  assert.equal(
    dataset.optionGroups.finish.values.find((value) => value.key === "partial-uv").artworkMode,
    "professional_pdf_upload_only"
  );

  const html = renderStorefrontProposalHtml(dataset);
  assert.match(html, /Ingen databaseændringer/);
  assert.match(html, /Produktet er ikke publiceret/);
  assert.match(html, /Professionel PDF-upload/);
  assert.match(html, /Online Designer/);
  assert.match(html, /Ingen interpolation/);
  assert.match(html, /data-model-key="model-01"/);
  assert.match(html, /data-model-key="model-21"/);
  assert.match(html, /Fast 1 mm ryg/);
  assert.match(html, /Rygbredden er et konstruktions- og skabelonvalg/);
  assert.match(html, /ikke på grund af prisen/);
  assert.match(html, /spinePriceBehavior/);
  assert.ok(html.indexOf("model-01") < html.indexOf("model-21"));
  assert.doesNotMatch(html, /file:\/\//);
});

test("honors an explicit proposed catalog scope and refuses to show its excluded model", () => {
  const data = fixture();
  const excludedModelKey = MODEL_KEYS.at(-1);
  data.proposal.optionGroups[0].values = data.proposal.optionGroups[0].values
    .filter((value) => value.key !== excludedModelKey);
  data.proposal.catalogScope = {
    rawSupplierEvidenceMutated: false,
    excludedModels: [{ modelKey: excludedModelKey, reasonDa: "Fravalgt" }],
    counts: { proposed: { folderModels: 20 } },
  };
  data.compatibility.combinations = data.compatibility.combinations
    .filter((combination) => combination.selections.folder_model !== excludedModelKey);
  data.priceRows = data.priceRows
    .filter((row) => row.selections.folder_model !== excludedModelKey);

  const dataset = buildStorefrontDataset(data);
  assert.equal(dataset.optionGroups.folder_model.values.length, 20);
  assert.equal(dataset.optionGroups.folder_model.values.some((value) => value.key === excludedModelKey), false);
  assert.equal(dataset.catalogScope.excludedModels[0].modelKey, excludedModelKey);
});

test("resolves a clicked finish to the nearest exact priced combination without changing folder model", () => {
  const combinations = [
    ["model-01", "4+0", "1mm", "chromo-mappekarton", "none", [[50, 300]]],
    ["model-01", "4+0", "1mm", "matt-billedtrykskarton", "soft-touch-lamination", [[50, 530]]],
    ["model-01", "4+4", "1mm", "matt-billedtrykskarton", "soft-touch-lamination", [[50, 630]]],
    ["model-02", "4+0", "3mm", "matt-billedtrykskarton", "soft-touch-lamination", [[50, 730]]],
  ];
  const currentSelection = {
    folder_model: "model-01",
    print: "4+0",
    spine: "1mm",
    paper: "chromo-mappekarton",
    finish: "none",
  };

  assert.deepEqual(
    resolveClosestExactCombination(
      combinations,
      AXES,
      currentSelection,
      "finish",
      "soft-touch-lamination"
    ),
    combinations[1]
  );
  assert.equal(
    resolveClosestExactCombination(combinations, AXES, currentSelection, "spine", "3mm"),
    null
  );
});

test("rejects interpolation, missing exact rows, and rows outside compatibility", () => {
  const first = fixture();
  assert.throws(
    () => buildStorefrontDataset({ ...first, compatibility: { ...first.compatibility, interpolationAllowed: true } }),
    /interpolation must remain disabled/i
  );

  const second = fixture();
  assert.throws(
    () => buildStorefrontDataset({ ...second, priceRows: second.priceRows.slice(0, -1) }),
    /price-row count does not match compatibility/i
  );

  const third = fixture();
  const unsupported = structuredClone(third.priceRows[0]);
  unsupported.selections.folder_model = "not-a-model";
  unsupported.proposedSelectionKey = `${selectionKey(unsupported.selections)}|quantity=${unsupported.quantity}`;
  assert.throws(
    () => buildStorefrontDataset({ ...third, priceRows: [unsupported, ...third.priceRows] }),
    /outside sparse compatibility/i
  );

  const fourth = fixture();
  fourth.priceRows[0].noInterpolation = false;
  assert.throws(
    () => buildStorefrontDataset(fourth),
    /does not explicitly prohibit interpolation/i
  );
});

test("writes a deterministic local-relative HTML review without mutating proposal, compatibility, or prices", async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-sales-folder-storefront-"));
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));
  const runDirectory = path.join(temporaryRoot, "run");
  const reviewDirectory = path.join(runDirectory, "review");
  const repoRoot = path.join(temporaryRoot, "repo");
  const assetDirectory = path.join(repoRoot, "assets");
  await fs.mkdir(reviewDirectory, { recursive: true });
  await fs.mkdir(assetDirectory, { recursive: true });

  const data = fixture();
  await fs.writeFile(path.join(assetDirectory, "hero.png"), "local hero fixture");
  await Promise.all(MODEL_KEYS.map((key) => fs.writeFile(path.join(assetDirectory, `${key}.svg`), "<svg></svg>")));
  const proposalPath = path.join(reviewDirectory, "consolidated-product-proposal.json");
  const compatibilityPath = path.join(reviewDirectory, "proposed-compatibility.json");
  const pricesPath = path.join(reviewDirectory, "proposed-price-rows.jsonl");
  await fs.writeFile(proposalPath, `${JSON.stringify(data.proposal, null, 2)}\n`);
  await fs.writeFile(compatibilityPath, `${JSON.stringify(data.compatibility, null, 2)}\n`);
  await fs.writeFile(pricesPath, `${data.priceRows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  const before = await Promise.all([proposalPath, compatibilityPath, pricesPath].map(sha256));

  const first = await buildStorefrontProposal({ runDirectory, repoRoot });
  const firstBytes = await fs.readFile(first.outputPath, "utf8");
  const second = await buildStorefrontProposal({ runDirectory, repoRoot });
  const secondBytes = await fs.readFile(second.outputPath, "utf8");
  const after = await Promise.all([proposalPath, compatibilityPath, pricesPath].map(sha256));

  assert.equal(first.sha256, second.sha256);
  assert.equal(firstBytes, secondBytes);
  assert.deepEqual(after, before);
  assert.equal(first.modelCount, 21);
  assert.equal(first.databaseWrites, false);
  assert.equal(first.published, false);
  assert.match(firstBytes, /\.\.\/\.\.\/repo\/assets\/hero\.png/);
  assert.match(firstBytes, /\.\.\/\.\.\/repo\/assets\/model-01\.svg/);
  assert.doesNotMatch(firstBytes, new RegExp(temporaryRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("uses a typed review error for invalid review state", () => {
  const data = fixture();
  data.proposal.status.productCreated = true;
  assert.throws(
    () => buildStorefrontDataset(data),
    (error) => error instanceof SalesFolderStorefrontProposalError && /created product/.test(error.message)
  );
});
