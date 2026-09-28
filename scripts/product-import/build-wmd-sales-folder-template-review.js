#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { sha256Json } from "./build-wmd-sales-folder-template-resolution-plan.js";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const DEFAULT_OUTPUT_NAME = "template-resolution-review.html";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const CLASSIFICATION_ORDER = Object.freeze([
  "pending_title_only",
  "indirect_pending_title_rebind",
  "exact_verified_rebind",
  "collateral_original_after_bad_alias_quarantine",
  "extended_exact_evidence",
]);

const CLASSIFICATION_META = Object.freeze({
  pending_title_only: {
    label: "Titeltekst afviger",
    tone: "warning",
    explanation: "Geometrien har et eksakt supplement, men den gengivne PDF skal stadig sammenlignes visuelt.",
  },
  indirect_pending_title_rebind: {
    label: "Rebind afhænger af titelreview",
    tone: "warning",
    explanation: "Den foreslåede PDF afhænger af en anden titeltekst-afklaring og kan ikke godkendes alene.",
  },
  exact_verified_rebind: {
    label: "Eksakt PDF-rebind",
    tone: "change",
    explanation: "Leverandørbindingen peger på en forkert geometri; planen foreslår en unik, eksakt PDF-identitet.",
  },
  collateral_original_after_bad_alias_quarantine: {
    label: "Original beholdes, alias isoleres",
    tone: "change",
    explanation: "Den originale PDF passer, mens krydsgeometri-aliaser skal forblive i karantæne.",
  },
  extended_exact_evidence: {
    label: "Udvidet eksakt bevis",
    tone: "evidence",
    explanation: "Guide-, kontrast- eller bytebevis bruges til at afklare geometri, som PDF-teksten ikke beviser alene.",
  },
});

export class TemplateResolutionReviewError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "TemplateResolutionReviewError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new TemplateResolutionReviewError(message, details);
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "en", { numeric: true }));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "Ukendt størrelse";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString("da-DK", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 ** 2)).toLocaleString("da-DK", { maximumFractionDigits: 1 })} MB`;
}

function sourcePageUrl(bindingKey) {
  const separatorIndex = bindingKey.lastIndexOf("|");
  const candidate = separatorIndex >= 0 ? bindingKey.slice(0, separatorIndex) : bindingKey;
  const parsed = new URL(candidate);
  assert(
    parsed.protocol === "https:" && parsed.hostname === "www.wir-machen-druck.de",
    "Binding source URL is outside the reviewed supplier host",
    { bindingKey }
  );
  return parsed.href;
}

function verifyPlanShape(plan) {
  assert(plan?.kind === "wmd_sales_folder_template_resolution_plan", "Unexpected resolution-plan kind");
  assert(plan?.schemaVersion === 1, "Unsupported resolution-plan schema version");
  assert(plan.reviewState === "pending_review", "Review artifact only accepts a pending plan");
  assert(plan.approval?.approved === false, "Review artifact refuses an approved plan");
  assert(plan.approval?.reviewer == null, "Pending plan must not name a reviewer");
  assert(plan.approval?.reviewedAt == null, "Pending plan must not contain a reviewed timestamp");
  assert(Array.isArray(plan.approvedEntryHashes) && plan.approvedEntryHashes.length === 0,
    "Pending plan must not contain approved entry hashes");
  assert(Array.isArray(plan.bindingClassifications), "Resolution plan is missing classifications");
  assert(Array.isArray(plan.bindingClassificationFingerprints), "Resolution plan is missing entry fingerprints");
  assert(Object.values(plan.prohibitedActionsPerformed || {}).every((value) => value === false),
    "Resolution plan reports a prohibited action");
}

function supplementEntriesByHash(supplement) {
  if (!supplement) return new Map();
  assert(supplement.kind === "wmd_sales_folder_geometry_supplement", "Unexpected geometry supplement kind");
  assert(supplement.reviewState === "pending_review", "Geometry supplement is no longer pending review");
  assert(Array.isArray(supplement.entries), "Geometry supplement is missing entries");
  const entries = new Map(supplement.entries.map((entry) => [sha256Json(entry), entry]));
  assert(entries.size === supplement.entries.length, "Geometry supplement contains duplicate entry fingerprints");
  for (const fingerprint of supplement.entryFingerprints || []) {
    assert(entries.has(fingerprint.entrySha256), "Geometry supplement fingerprint does not match an entry", fingerprint);
  }
  return entries;
}

function groupKey(entry) {
  return sha256Json({
    classification: entry.classification,
    expectedGeometryKey: entry.expectedGeometryKey,
    proposedPdfSha256: entry.newTemplate.sha256,
    reason: entry.reason,
    dependencies: entry.evidence?.dependencies || {},
  });
}

export function buildTemplateResolutionReviewDataset({ plan, supplement = null, planFingerprint = null }) {
  verifyPlanShape(plan);
  const fingerprintsByBinding = new Map(
    plan.bindingClassificationFingerprints.map((entry) => [entry.bindingKey, entry.entrySha256])
  );
  assert(fingerprintsByBinding.size === plan.bindingClassificationFingerprints.length,
    "Resolution plan contains duplicate binding fingerprints");

  const titleEntries = supplementEntriesByHash(supplement);
  const extendedFamilies = new Map(
    (plan.extendedEvidence?.families || []).map((family) => [family.familyKey, family])
  );
  const recovered = plan.bindingClassifications.filter((entry) => entry.classification !== "base_verified");
  assert(recovered.length === plan.counts?.recoveredBindingsPendingReview,
    "Recovered binding count does not match the resolution-plan summary");

  const groups = new Map();
  for (const entry of recovered) {
    assert(CLASSIFICATION_META[entry.classification], "Unknown recovered classification", entry.classification);
    assert(entry.entryReviewState === "pending_review", "Recovered entry is not pending review", entry.bindingKey);
    assert(SHA256_PATTERN.test(entry.oldTemplate?.sha256 || ""), "Recovered entry has an invalid old PDF hash", entry.bindingKey);
    assert(SHA256_PATTERN.test(entry.newTemplate?.sha256 || ""), "Recovered entry has an invalid proposed PDF hash", entry.bindingKey);
    const entrySha256 = fingerprintsByBinding.get(entry.bindingKey);
    assert(SHA256_PATTERN.test(entrySha256 || ""), "Recovered entry is missing its hash-pinned fingerprint", entry.bindingKey);
    assert(entrySha256 === sha256Json(entry), "Recovered entry fingerprint drifted", entry.bindingKey);

    const dependencies = entry.evidence?.dependencies || {};
    const resolvedTitleEntries = (dependencies.titleSupplementEntrySha256s || []).map((entryHash) => {
      const titleEntry = titleEntries.get(entryHash);
      assert(titleEntry, "A recovered entry refers to missing title-supplement evidence", {
        bindingKey: entry.bindingKey,
        entryHash,
      });
      return { entrySha256: entryHash, ...titleEntry };
    });
    const extendedFamilyKey = entry.evidence?.resolutionFacts?.extendedFamilyKey;
    const extendedFamily = extendedFamilyKey ? extendedFamilies.get(extendedFamilyKey) : null;
    assert(!extendedFamilyKey || extendedFamily, "A recovered entry refers to missing extended evidence", entry.bindingKey);

    const key = groupKey(entry);
    if (!groups.has(key)) {
      groups.set(key, {
        id: `review-${key.slice(0, 12)}`,
        classification: entry.classification,
        expectedGeometryKey: entry.expectedGeometryKey,
        reason: entry.reason,
        dependencies,
        titleEvidence: resolvedTitleEntries,
        extendedFamily,
        entries: [],
      });
    }
    groups.get(key).entries.push({ ...entry, entrySha256, sourcePageUrl: sourcePageUrl(entry.bindingKey) });
  }

  const packets = [...groups.values()].map((group) => {
    group.entries.sort((left, right) => left.selectionKey.localeCompare(right.selectionKey, "en", { numeric: true }));
    return {
      ...group,
      bindingCount: group.entries.length,
      finishKeys: sortedUnique(group.entries.map((entry) => entry.finishKey)),
      blockerCodes: sortedUnique(group.entries.flatMap((entry) => entry.baseAuditState?.blockerCodes || [])),
      sanitizerVerdicts: sortedUnique(group.entries.map((entry) => entry.sanitizerVerdictAfterApproval)),
      sourceEvidenceBindingKeys: sortedUnique(
        group.entries.flatMap((entry) => entry.evidence?.sourceEvidenceBindingKeys || [])
      ),
      proposedDocuments: [...new Map(group.entries.map((entry) => [
        `${entry.newTemplate.localRelativePath}|${entry.newTemplate.sha256}`,
        entry.newTemplate,
      ])).values()],
      oldDocuments: [...new Map(group.entries.map((entry) => [
        `${entry.oldTemplate.localRelativePath}|${entry.oldTemplate.sha256}`,
        entry.oldTemplate,
      ])).values()],
      quarantinedBindingKeys: sortedUnique(
        group.entries.flatMap((entry) => entry.aliasQuarantineResult?.quarantinedBindingKeys || [])
      ),
    };
  });

  packets.sort((left, right) => {
    const classDifference = CLASSIFICATION_ORDER.indexOf(left.classification)
      - CLASSIFICATION_ORDER.indexOf(right.classification);
    return classDifference || left.expectedGeometryKey.localeCompare(right.expectedGeometryKey, "en", { numeric: true });
  });

  const classificationCounts = Object.fromEntries(CLASSIFICATION_ORDER.map((classification) => [
    classification,
    recovered.filter((entry) => entry.classification === classification).length,
  ]));
  for (const classification of CLASSIFICATION_ORDER) {
    assert(classificationCounts[classification] === plan.counts.classifications[classification],
      "Classification count drifted", { classification });
  }

  assert(new Set(packets.flatMap((packet) => packet.entries.map((entry) => entry.bindingKey))).size === recovered.length,
    "A recovered binding appears in more than one review packet");

  return {
    kind: "wmd_sales_folder_template_human_review",
    schemaVersion: 1,
    state: "pending_review_read_only",
    approval: { approved: false, reviewer: null, reviewedAt: null },
    planFingerprint,
    planCounts: plan.counts,
    approvalContract: plan.approvalContract,
    nextGate: plan.nextGate,
    prohibitedActionsPerformed: plan.prohibitedActionsPerformed,
    classificationCounts,
    packetCount: packets.length,
    recoveredBindingCount: recovered.length,
    baseVerifiedBindingCount: plan.counts.baseVerifiedBindings,
    inputEvidence: plan.inputEvidence,
    packets,
  };
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  let byteSize = 0;
  for await (const chunk of createReadStream(filePath)) {
    byteSize += chunk.length;
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), byteSize };
}

function resolveRunPath(runDirectory, relativePath) {
  assert(typeof relativePath === "string" && relativePath.length > 0, "Evidence path is missing");
  const resolvedRun = path.resolve(runDirectory);
  const resolved = path.resolve(resolvedRun, relativePath);
  assert(resolved.startsWith(`${resolvedRun}${path.sep}`), "Evidence path escapes the run directory", relativePath);
  return resolved;
}

function collectDisplayedEvidenceSpecs(plan) {
  const specs = [];
  for (const value of Object.values(plan.inputEvidence || {})) {
    if (Array.isArray(value)) specs.push(...value);
    else if (value?.path) specs.push(value);
  }
  for (const entry of plan.bindingClassifications.filter((candidate) => candidate.classification !== "base_verified")) {
    specs.push({ path: entry.oldTemplate.localRelativePath, sha256: entry.oldTemplate.sha256 });
    specs.push({ path: entry.newTemplate.localRelativePath, sha256: entry.newTemplate.sha256 });
  }
  const byPath = new Map();
  for (const spec of specs) {
    assert(SHA256_PATTERN.test(spec.sha256 || ""), "Evidence file has an invalid expected SHA-256", spec);
    const current = byPath.get(spec.path);
    assert(!current || current.sha256 === spec.sha256, "The same evidence path has conflicting hashes", spec.path);
    byPath.set(spec.path, spec);
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path, "en", { numeric: true }));
}

async function verifyEvidenceFiles(runDirectory, specs) {
  const verified = [];
  for (const spec of specs) {
    const absolutePath = resolveRunPath(runDirectory, spec.path);
    const actual = await hashFile(absolutePath);
    assert(actual.sha256 === spec.sha256, "Evidence file hash drifted", {
      path: spec.path,
      expected: spec.sha256,
      actual: actual.sha256,
    });
    if (Number.isFinite(spec.bytes)) {
      assert(actual.byteSize === spec.bytes, "Evidence file byte size drifted", spec.path);
    }
    verified.push({ path: spec.path, sha256: actual.sha256, byteSize: actual.byteSize, status: "verified" });
  }
  return verified;
}

function localHref(runDirectory, outputPath, relativePath) {
  const absolutePath = resolveRunPath(runDirectory, relativePath);
  const relative = path.relative(path.dirname(outputPath), absolutePath).split(path.sep).join("/");
  return relative.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function renderHash(value) {
  return `<code class="hash">${escapeHtml(value)}</code>`;
}

function renderDocument(document, label, runDirectory, outputPath) {
  const href = localHref(runDirectory, outputPath, document.localRelativePath);
  return `<div class="document">
    <div><strong>${escapeHtml(label)}</strong> <a href="${escapeHtml(href)}" target="_blank">Åbn lokal PDF</a></div>
    <div class="path">${escapeHtml(document.localRelativePath)}</div>
    <div>SHA-256 ${renderHash(document.sha256)}</div>
  </div>`;
}

function renderTitleEvidence(entry, runDirectory, outputPath) {
  return `<div class="evidence-card">
    <strong>Titelsupplement · ${escapeHtml(entry.verdict)}</strong>
    <div>Status: <span class="status pending">${escapeHtml(entry.renderedReviewEvidence?.status || "pending_review")}</span></div>
    <div>Bevis-entry ${renderHash(entry.entrySha256)}</div>
    ${renderDocument(entry.sourceTemplate, "Kilde-PDF", runDirectory, outputPath)}
    ${renderDocument(entry.verifiedWindowCounterpart, "Geometrisk modpart", runDirectory, outputPath)}
    <div class="fingerprints">Sidebokse ${renderHash(entry.comparisons?.pageBoxes?.sourceSha256 || "mangler")} · Rillen ${renderHash(entry.comparisons?.rillen?.sourceFingerprint || "mangler")} · Schneiden ${renderHash(entry.comparisons?.schneiden?.sourceFingerprint || "mangler")}</div>
  </div>`;
}

function renderExtendedEvidence(family, runDirectory, outputPath) {
  if (!family) return "";
  return `<div class="evidence-card">
    <strong>Udvidet bevisfamilie · ${escapeHtml(family.familyKey)}</strong>
    <div>Reviewtilstand: <span class="status pending">${escapeHtml(family.reviewState || "pending_review")}</span></div>
    <ul>${(family.requirements || []).map((requirement) => `<li>${escapeHtml(requirement)}</li>`).join("")}</ul>
    <div class="documents">${(family.evidenceFiles || []).map((file) => renderDocument(
      { ...file, localRelativePath: file.localRelativePath || file.path },
      file.role,
      runDirectory,
      outputPath
    )).join("")}</div>
  </div>`;
}

function renderPacket(packet, runDirectory, outputPath) {
  const meta = CLASSIFICATION_META[packet.classification];
  const proposedChanged = packet.entries.some((entry) => entry.oldTemplate.sha256 !== entry.newTemplate.sha256);
  const searchText = [
    packet.classification,
    packet.expectedGeometryKey,
    packet.reason,
    ...packet.finishKeys,
    ...packet.blockerCodes,
    ...packet.entries.flatMap((entry) => [entry.bindingKey, entry.selectionKey, entry.entrySha256, entry.oldTemplate.sha256, entry.newTemplate.sha256]),
  ].join(" ").toLocaleLowerCase("da-DK");
  const dependencyRows = Object.entries(packet.dependencies || {}).flatMap(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.filter(Boolean).map((item) => `<div><span>${escapeHtml(key)}</span>${renderHash(item)}</div>`);
  }).join("");
  const rows = packet.entries.map((entry) => `<tr data-binding-row>
    <td><a href="${escapeHtml(entry.sourcePageUrl)}" target="_blank" rel="noreferrer">Kildeside</a><div class="binding-key">${escapeHtml(entry.bindingKey)}</div></td>
    <td><strong>${escapeHtml(entry.selectionKey)}</strong><div>${escapeHtml(entry.finishKey)}</div></td>
    <td>${renderDocument(entry.oldTemplate, "Gammel", runDirectory, outputPath)}</td>
    <td>${renderDocument(entry.newTemplate, "Foreslået", runDirectory, outputPath)}</td>
    <td>${renderHash(entry.entrySha256)}<div class="status pending">${escapeHtml(entry.entryReviewState)}</div></td>
  </tr>`).join("");

  return `<article class="packet" data-review-packet data-classification="${escapeHtml(packet.classification)}" data-binding-count="${packet.bindingCount}" data-search="${escapeHtml(searchText)}">
    <header class="packet-head">
      <div><span class="badge ${escapeHtml(meta.tone)}">${escapeHtml(meta.label)}</span><h2>${escapeHtml(packet.expectedGeometryKey)}</h2><p>${escapeHtml(meta.explanation)}</p></div>
      <div class="packet-count"><strong>${packet.bindingCount.toLocaleString("da-DK")}</strong><span>bindings</span><span class="status pending">Afventer</span></div>
    </header>
    <div class="packet-grid">
      <div><h3>Foreslået dokumentidentitet</h3>${packet.proposedDocuments.map((document) => renderDocument(document, proposedChanged ? "Ny PDF" : "Behold PDF", runDirectory, outputPath)).join("")}</div>
      <div><h3>Hvorfor er pakken med?</h3><p>${escapeHtml(packet.reason)}</p><div class="chips">${packet.blockerCodes.map((code) => `<span>${escapeHtml(code)}</span>`).join("")}</div></div>
      <div><h3>Afhængighedshashes</h3><div class="dependency-list">${dependencyRows || "Ingen ekstra afhængighed"}</div></div>
    </div>
    ${packet.titleEvidence.map((entry) => renderTitleEvidence(entry, runDirectory, outputPath)).join("")}
    ${renderExtendedEvidence(packet.extendedFamily, runDirectory, outputPath)}
    <details><summary>Vis alle ${packet.bindingCount.toLocaleString("da-DK")} hash-pinnede bindings</summary>
      <div class="table-scroll"><table><thead><tr><th>Binding</th><th>Valg</th><th>Gammel PDF</th><th>Foreslået PDF</th><th>Entry-hash / status</th></tr></thead><tbody>${rows}</tbody></table></div>
    </details>
  </article>`;
}

export function renderTemplateResolutionReviewHtml(dataset, { runDirectory, outputPath, verifiedEvidence = [] }) {
  const filterButtons = CLASSIFICATION_ORDER.map((classification) => {
    const meta = CLASSIFICATION_META[classification];
    return `<button type="button" data-filter="${escapeHtml(classification)}" aria-pressed="false">${escapeHtml(meta.label)} <span>${dataset.classificationCounts[classification].toLocaleString("da-DK")}</span></button>`;
  }).join("");
  const evidenceRows = verifiedEvidence.map((entry) => `<tr><td><a href="${escapeHtml(localHref(runDirectory, outputPath, entry.path))}" target="_blank">${escapeHtml(entry.path)}</a></td><td>${renderHash(entry.sha256)}</td><td>${escapeHtml(formatBytes(entry.byteSize))}</td><td><span class="status verified">Verificeret</span></td></tr>`).join("");
  const packetHtml = dataset.packets.map((packet) => renderPacket(packet, runDirectory, outputPath)).join("");
  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PDF-skabelonreview · salgsmapper</title>
  <style>
    :root{--blue:#0ea5e9;--blue-dark:#0369a1;--ink:#0f172a;--muted:#64748b;--line:#cbd5e1;--soft:#f8fafc;--warn:#b45309;--violet:#6d28d9}*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input{font:inherit}a{color:var(--blue-dark)}button:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid rgba(14,165,233,.35);outline-offset:2px}.bar{position:sticky;top:0;z-index:10;padding:11px 20px;background:#0f172a;color:#fff;text-align:center;font-weight:800}.bar strong{color:#7dd3fc}.page{width:min(1420px,calc(100% - 32px));margin:0 auto;padding:30px 0 70px}.hero{padding:30px;border:1px solid #bae6fd;border-radius:22px;background:#fff;box-shadow:0 14px 40px rgba(15,23,42,.07)}.eyebrow{color:var(--blue-dark);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{margin:8px 0 12px;font-size:clamp(32px,5vw,54px);line-height:1.02;letter-spacing:-.04em}.lede{max-width:85ch;margin:0;color:#475569;font-size:17px;line-height:1.6}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:24px}.stat{padding:15px;border:1px solid #dbeafe;border-radius:14px;background:#f0f9ff}.stat strong{display:block;font-size:25px}.stat span{color:#475569;font-size:13px}.stop{margin-top:16px;padding:14px 16px;border-left:5px solid var(--blue);border-radius:10px;background:#f0f9ff;line-height:1.55}.controls{position:sticky;top:43px;z-index:9;margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px rgba(15,23,42,.07);backdrop-filter:blur(8px)}.search{width:100%;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:11px}.filters{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.filters button{min-height:42px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;cursor:pointer}.filters button[aria-pressed=true]{border-color:var(--blue);background:#f0f9ff;color:#075985}.filters span{margin-left:5px;font-weight:850}.visible-count{margin:10px 2px 0;color:var(--muted);font-size:13px}.section-title{margin:34px 0 12px}.section-title h2{margin:0;font-size:27px}.section-title p{margin:6px 0 0;color:var(--muted)}.packet{margin-top:14px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 8px 22px rgba(15,23,42,.04)}.packet[hidden]{display:none}.packet-head{display:flex;justify-content:space-between;gap:18px;padding:20px;border-bottom:1px solid #e2e8f0}.packet-head h2{margin:8px 0 5px;font-size:21px;overflow-wrap:anywhere}.packet-head p{margin:0;color:#475569}.packet-count{min-width:100px;text-align:right}.packet-count strong{display:block;font-size:25px}.packet-count span{display:block;font-size:12px}.badge,.status{display:inline-flex;width:max-content;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:850}.badge.warning{background:#fff7ed;color:#9a3412}.badge.change{background:#ede9fe;color:#5b21b6}.badge.evidence{background:#e0f2fe;color:#075985}.status.pending{margin-top:6px;background:#f1f5f9;color:#475569}.status.verified{background:#e0f2fe;color:#075985}.packet-grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:14px;padding:18px 20px}.packet-grid>div{min-width:0;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:var(--soft)}h3{margin:0 0 9px;font-size:15px}.packet-grid p{margin:0;color:#475569;line-height:1.5}.document{margin:8px 0;padding:10px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;font-size:12px;line-height:1.55}.path,.binding-key{color:var(--muted);overflow-wrap:anywhere}.hash{font-size:11px;overflow-wrap:anywhere;word-break:break-all}.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.chips span{padding:4px 7px;border-radius:7px;background:#e2e8f0;font-size:10px;font-weight:750}.dependency-list>div{margin-bottom:7px}.dependency-list span{display:block;color:var(--muted);font-size:11px}.evidence-card{margin:0 20px 14px;padding:14px;border:1px solid #bae6fd;border-radius:12px;background:#f0f9ff;font-size:13px;line-height:1.55}.evidence-card ul{margin:8px 0;padding-left:21px}.documents{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.fingerprints{margin-top:8px}details{border-top:1px solid #e2e8f0}summary{padding:16px 20px;cursor:pointer;font-weight:800}.table-scroll{overflow:auto;padding:0 20px 20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border:1px solid #e2e8f0;text-align:left;vertical-align:top}th{background:#f8fafc}.evidence{margin-top:28px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;overflow:hidden}.evidence summary{font-size:17px}.boundary{margin-top:28px;padding:20px;border:1px solid #bae6fd;border-radius:16px;background:#f0f9ff;line-height:1.6}.boundary h2{margin:0 0 7px;font-size:20px}.boundary p{margin:5px 0}.empty{display:none;margin-top:14px;padding:18px;border-radius:12px;background:#fff7ed;color:#9a3412}.empty.visible{display:block}@media(max-width:960px){.stats{grid-template-columns:1fr 1fr}.packet-grid{grid-template-columns:1fr}.documents{grid-template-columns:1fr}.controls{position:static}}@media(max-width:620px){.page{width:min(100% - 18px,1420px);padding-top:14px}.hero{padding:20px}.stats{grid-template-columns:1fr}.packet-head{flex-direction:column}.packet-count{text-align:left}.controls{padding:12px}}
  </style>
</head>
<body>
  <div class="bar"><strong>KUN LÆSNING</strong> · Ingen godkendelse · Ingen database- eller netværksskrivning</div>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">Webprinter · menneskelig PDF-gate</div>
      <h1>Gennemgå de gendannede salgsmappe-skabeloner</h1>
      <p class="lede">Siden samler alle hash-pinnede undtagelser, der skal vurderes, før nogen leverandør-PDF må saniteres eller forbindes til et Webprinter-produkt. De ${dataset.baseVerifiedBindingCount.toLocaleString("da-DK")} allerede basisverificerede bindings er med vilje skjult.</p>
      <div class="stats">
        <div class="stat"><strong>${dataset.recoveredBindingCount.toLocaleString("da-DK")}</strong><span>bindings afventer menneskelig gennemgang</span></div>
        <div class="stat"><strong>${dataset.packetCount.toLocaleString("da-DK")}</strong><span>grupperede reviewpakker</span></div>
        <div class="stat"><strong>${verifiedEvidence.length.toLocaleString("da-DK")}</strong><span>lokale filer hash-verificeret ved generering</span></div>
        <div class="stat"><strong>0</strong><span>godkendelser eller systemskrivninger</span></div>
      </div>
      <div class="stop"><strong>Nuværende status: afventer.</strong> Denne HTML kan ikke ændre status. Selv en visuel accept her er ikke en importgodkendelse; den kontrollerede plan skal senere regenereres med reviewer, tidspunkt og præcis entry-hash for hver accepteret binding.</div>
    </section>

    <section class="controls" aria-label="Filtrér reviewpakker">
      <input class="search" id="search" type="search" placeholder="Søg efter format, konstruktion, finish, binding, blocker eller SHA-256">
      <div class="filters"><button type="button" data-filter="all" aria-pressed="true">Alle <span>${dataset.recoveredBindingCount.toLocaleString("da-DK")}</span></button>${filterButtons}</div>
      <div class="visible-count" id="visible-count" aria-live="polite"></div>
    </section>

    <div class="section-title"><h2>Reviewpakker</h2><p>Åbn en pakke for at se samtlige bindings, kildevalg, gammel PDF, foreslået PDF, entry-hash og afventende status.</p></div>
    <div id="packets">${packetHtml}</div>
    <div class="empty" id="empty">Ingen reviewpakker matcher filteret.</div>

    <details class="evidence">
      <summary>Vis verificeret input- og PDF-bevis</summary>
      <div class="table-scroll"><table><thead><tr><th>Lokal fil</th><th>SHA-256</th><th>Størrelse</th><th>Status</th></tr></thead><tbody>${evidenceRows}</tbody></table></div>
    </details>

    <section class="boundary">
      <h2>Stopgrænse før Webprinter-import</h2>
      <p>Planstatus: <strong>${escapeHtml(dataset.state)}</strong>. Næste gate: ${escapeHtml(dataset.nextGate)}.</p>
      <p>Sanitering, Supplier Bank-skrivning, produktoprettelse, priser, Designer-binding og publicering er fortsat blokeret. Denne side har ingen knap eller kodevej, der kan udføre disse handlinger.</p>
      <p>Planfil: ${renderHash(dataset.planFingerprint?.sha256 || "ukendt")} · ${escapeHtml(formatBytes(dataset.planFingerprint?.byteSize))} · separat SHA-256-sidecar verificeret.</p>
    </section>
  </main>
  <script>
    const cards = [...document.querySelectorAll("[data-review-packet]")];
    const search = document.getElementById("search");
    const visibleCount = document.getElementById("visible-count");
    const empty = document.getElementById("empty");
    let activeFilter = "all";
    function applyFilters() {
      const query = search.value.trim().toLocaleLowerCase("da-DK");
      let packets = 0;
      let bindings = 0;
      for (const card of cards) {
        const visible = (activeFilter === "all" || card.dataset.classification === activeFilter)
          && (!query || card.dataset.search.includes(query));
        card.hidden = !visible;
        if (visible) { packets += 1; bindings += Number(card.dataset.bindingCount); }
      }
      visibleCount.textContent = packets.toLocaleString("da-DK") + " pakker · " + bindings.toLocaleString("da-DK") + " bindings synlige";
      empty.classList.toggle("visible", packets === 0);
    }
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
        applyFilters();
      });
    });
    search.addEventListener("input", applyFilters);
    applyFilters();
  </script>
</body>
</html>`;
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents, { mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

function sameEvidence(left, right) {
  return left.length === right.length && left.every((entry, index) => (
    entry.path === right[index].path
    && entry.sha256 === right[index].sha256
    && entry.byteSize === right[index].byteSize
  ));
}

export async function generateTemplateResolutionReview({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  outputPath = null,
  writeOutput = true,
} = {}) {
  const resolvedRunDirectory = path.resolve(runDirectory);
  const reviewDirectory = path.join(resolvedRunDirectory, "review");
  const resolvedOutputPath = path.resolve(outputPath || path.join(reviewDirectory, DEFAULT_OUTPUT_NAME));
  assert(path.dirname(resolvedOutputPath) === path.resolve(reviewDirectory),
    "Template review output must stay in the run review directory");

  const planPath = path.join(reviewDirectory, "template-resolution-plan.json");
  const planBytes = await fs.readFile(planPath);
  const planFingerprint = { sha256: createHash("sha256").update(planBytes).digest("hex"), byteSize: planBytes.length };
  const sidecar = await fs.readFile(`${planPath}.sha256`, "utf8");
  assert(sidecar === `${planFingerprint.sha256}  template-resolution-plan.json\n`,
    "Template resolution plan sidecar does not match the plan bytes");
  const plan = JSON.parse(planBytes);
  verifyPlanShape(plan);

  const specs = collectDisplayedEvidenceSpecs(plan);
  const verifiedEvidence = await verifyEvidenceFiles(resolvedRunDirectory, specs);
  const supplementPath = resolveRunPath(resolvedRunDirectory, plan.inputEvidence.geometrySupplement.path);
  const supplement = JSON.parse(await fs.readFile(supplementPath, "utf8"));
  const dataset = buildTemplateResolutionReviewDataset({ plan, supplement, planFingerprint });
  const html = renderTemplateResolutionReviewHtml(dataset, {
    runDirectory: resolvedRunDirectory,
    outputPath: resolvedOutputPath,
    verifiedEvidence,
  });
  const outputSha256 = createHash("sha256").update(html).digest("hex");

  if (writeOutput) {
    await fs.mkdir(reviewDirectory, { recursive: true });
    await writeAtomic(resolvedOutputPath, html);
    await writeAtomic(`${resolvedOutputPath}.sha256`, `${outputSha256}  ${path.basename(resolvedOutputPath)}\n`);
    const verifiedAfterWrite = await verifyEvidenceFiles(resolvedRunDirectory, specs);
    assert(sameEvidence(verifiedEvidence, verifiedAfterWrite), "Review evidence changed during HTML generation");
    const currentPlanBytes = await fs.readFile(planPath);
    assert(createHash("sha256").update(currentPlanBytes).digest("hex") === planFingerprint.sha256,
      "Template resolution plan changed during HTML generation");
  }

  return {
    outputPath: resolvedOutputPath,
    outputSha256,
    byteSize: Buffer.byteLength(html),
    packetCount: dataset.packetCount,
    recoveredBindingCount: dataset.recoveredBindingCount,
    verifiedEvidenceFileCount: verifiedEvidence.length,
    state: dataset.state,
    approvalChanged: false,
    databaseWrites: false,
    networkRequests: false,
    html,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run") options.runDirectory = argv[++index];
    else if (argument === "--output") options.outputPath = argv[++index];
    else if (argument === "--no-write") options.writeOutput = false;
    else if (argument === "--help") options.help = true;
    else throw new TemplateResolutionReviewError(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write("Usage: node scripts/product-import/build-wmd-sales-folder-template-review.js [--run <directory>] [--output <review/template-resolution-review.html>] [--no-write]\n");
    return;
  }
  const result = await generateTemplateResolutionReview(options);
  const { html: _html, ...summary } = result;
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.name}: ${error.message}\n`);
    if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    process.exitCode = 1;
  });
}
