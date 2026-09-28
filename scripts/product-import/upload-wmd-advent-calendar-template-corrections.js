#!/usr/bin/env node
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);
const EXPECTED_FAMILIES = 14;
const EXPECTED_TEMPLATES = 28;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const runDirIndex = argv.indexOf("--run-dir");
  return {
    runDir:
      runDirIndex >= 0 && argv[runDirIndex + 1]
        ? path.resolve(argv[runDirIndex + 1])
        : DEFAULT_RUN_DIR,
    writeTemplateFiles: argv.includes("--write-template-files"),
  };
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return { url, serviceRoleKey };
}

function validateInspection(slug, document, inspection, pdfBuffer) {
  const expectedLayerNames = new Set([
    "Skære-, fals- og sikkerhedslinjer - ikke til tryk",
    "Webprinter-information - ikke til tryk",
  ]);
  const layers = inspection.layers || [];
  const actualLayerNames = new Set(layers.map((layer) => layer.name));
  const layersMatch =
    actualLayerNames.size === expectedLayerNames.size &&
    [...expectedLayerNames].every((name) => actualLayerNames.has(name));
  const valid =
    inspection.schemaVersion >= 2 &&
    inspection.vectorGeometryPreserved === true &&
    inspection.fullPageRasterization === false &&
    inspection.outputRasterImageCount === 0 &&
    inspection.webprinterPanelHex === "#0EA5E9" &&
    inspection.nonVisibleAreaHex === "#D1D5DB" &&
    inspection.lineLegend?.cutAndDie === "#EC008C" &&
    inspection.lineLegend?.safeArea === "#2F80ED" &&
    inspection.lineLegend?.fold === "#00A7C4" &&
    inspection.redAreaFillsRemaining === 0 &&
    inspection.redAreasConvertedToNeutralGray === true &&
    inspection.panelTextContained === true &&
    inspection.supplierMetadataRemoved === true &&
    inspection.supplierBrandingRemoved === true &&
    inspection.visualReviewPending === false &&
    layersMatch &&
    layers.every(
      (layer) =>
        layer.viewState === "/ON" &&
        layer.printState === "/OFF" &&
        layer.exportState === "/OFF",
    ) &&
    inspection.outputSha256 === sha256(pdfBuffer);
  if (!valid) {
    throw new Error(
      `${slug}/${document.key}: template inspection does not satisfy the vector, layer, blue-panel, containment, and visual-review contract`,
    );
  }
}

function loadTemplates(runDir) {
  const familiesDir = path.join(runDir, "families");
  const familyNames = fs
    .readdirSync(familiesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (familyNames.length !== EXPECTED_FAMILIES) {
    throw new Error(`Expected ${EXPECTED_FAMILIES} families, found ${familyNames.length}`);
  }

  const templates = [];
  for (const familyName of familyNames) {
    const familyDir = path.join(familiesDir, familyName);
    const manifest = readJson(path.join(familyDir, "import-manifest.json"));
    if (manifest.target?.publishProduct !== false || manifest.target?.writeLivePricing !== false) {
      throw new Error(`${manifest.product.slugDa}: publication safeguards are not locked`);
    }
    for (const document of manifest.documents) {
      const pdfPath = path.join(familyDir, document.template.sanitizedPdfPath);
      const inspectionPath = path.join(familyDir, document.template.inspectionPath);
      const pdfBuffer = fs.readFileSync(pdfPath);
      const inspection = readJson(inspectionPath);
      validateInspection(manifest.product.slugDa, document, inspection, pdfBuffer);
      const pdfName = path.basename(document.template.sanitizedPdfPath);
      templates.push({
        slug: manifest.product.slugDa,
        documentKey: document.key,
        designerTemplateId: document.template.designerTemplateId,
        pdfPath,
        localSha256: sha256(pdfBuffer),
        objectPath: `template-pdfs/advent-calendars-2026/${manifest.product.slugDa}/${pdfName}`,
      });
    }
  }
  if (templates.length !== EXPECTED_TEMPLATES) {
    throw new Error(`Expected ${EXPECTED_TEMPLATES} templates, found ${templates.length}`);
  }
  return templates;
}

async function uploadAndVerify(client, template, runDir) {
  const pdfBuffer = fs.readFileSync(template.pdfPath);
  const { data: existing, error: existingError } = await client.storage
    .from("design-library")
    .download(template.objectPath);
  if (existingError) {
    throw new Error(
      `${template.slug}/${template.documentKey}: could not back up existing object: ${existingError.message}`,
    );
  }
  const existingBuffer = Buffer.from(await existing.arrayBuffer());
  const backupPath = path.join(
    runDir,
    "rollback",
    "design-library",
    template.objectPath,
  );
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (!fs.existsSync(backupPath)) fs.writeFileSync(backupPath, existingBuffer);
  const previousSha256 = sha256(existingBuffer);

  const { error: uploadError } = await client.storage
    .from("design-library")
    .upload(template.objectPath, pdfBuffer, {
      contentType: "application/pdf",
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`${template.slug}/${template.documentKey}: ${uploadError.message}`);
  }

  const { data: downloaded, error: downloadError } = await client.storage
    .from("design-library")
    .download(template.objectPath);
  if (downloadError) {
    throw new Error(`${template.slug}/${template.documentKey}: ${downloadError.message}`);
  }
  const remoteSha256 = sha256(Buffer.from(await downloaded.arrayBuffer()));
  if (remoteSha256 !== template.localSha256) {
    throw new Error(`${template.slug}/${template.documentKey}: remote hash mismatch`);
  }

  const publicUrl = client.storage
    .from("design-library")
    .getPublicUrl(template.objectPath).data.publicUrl;
  if (template.designerTemplateId) {
    const { data, error } = await client
      .from("designer_templates")
      .select("id, template_pdf_url")
      .eq("id", template.designerTemplateId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.template_pdf_url !== publicUrl) {
      throw new Error(`${template.slug}/${template.documentKey}: designer template link mismatch`);
    }
  }
  return { ...template, backupPath, previousSha256, remoteSha256, publicUrl };
}

async function main() {
  const args = parseArgs(process.argv);
  const templates = loadTemplates(args.runDir);
  const plan = {
    mode: args.writeTemplateFiles ? "write-template-files" : "dry-run",
    templates: templates.length,
    bucket: "design-library",
    backupBeforeOverwrite: true,
    pricesChanged: false,
    productsPublished: false,
    objects: templates.map(({ slug, documentKey, objectPath, localSha256 }) => ({
      slug,
      documentKey,
      objectPath,
      localSha256,
    })),
  };
  if (!args.writeTemplateFiles) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const uploaded = [];
  for (const template of templates) {
    const verified = await uploadAndVerify(client, template, args.runDir);
    uploaded.push(verified);
    console.log(`verified template: ${template.slug}/${template.documentKey}`);
  }
  const summary = {
    correctedAt: new Date().toISOString(),
    templates: uploaded.length,
    pricesChanged: false,
    productsPublished: false,
    uploaded: uploaded.map(
      ({
        slug,
        documentKey,
        designerTemplateId,
        objectPath,
        publicUrl,
        backupPath,
        previousSha256,
        localSha256,
        remoteSha256,
      }) => ({
        slug,
        documentKey,
        designerTemplateId,
        objectPath,
        publicUrl,
        backupPath,
        previousSha256,
        localSha256,
        remoteSha256,
      }),
    ),
  };
  const outputPath = path.join(args.runDir, "template-correction-upload-summary.json");
  writeJson(outputPath, summary);
  console.log(JSON.stringify({ outputPath, templates: uploaded.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
