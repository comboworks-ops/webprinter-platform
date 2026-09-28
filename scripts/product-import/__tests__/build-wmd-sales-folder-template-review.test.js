import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTemplateResolutionReviewDataset,
  generateTemplateResolutionReview,
  renderTemplateResolutionReviewHtml,
} from "../build-wmd-sales-folder-template-review.js";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../../..");
const RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const REVIEW_DIRECTORY = path.join(RUN_DIRECTORY, "review");

let inputsPromise;

async function inputs() {
  if (!inputsPromise) {
    inputsPromise = Promise.all([
      fs.readFile(path.join(REVIEW_DIRECTORY, "template-resolution-plan.json"), "utf8").then(JSON.parse),
      fs.readFile(path.join(REVIEW_DIRECTORY, "template-geometry-supplement.json"), "utf8").then(JSON.parse),
    ]).then(([plan, supplement]) => ({ plan, supplement }));
  }
  return inputsPromise;
}

test("human review dataset groups all 522 proposed recovered bindings without approving any entry", async () => {
  const { plan, supplement } = await inputs();
  const dataset = buildTemplateResolutionReviewDataset({ plan, supplement });
  assert.equal(dataset.kind, "wmd_sales_folder_template_human_review");
  assert.equal(dataset.state, "pending_review_read_only");
  assert.deepEqual(dataset.approval, { approved: false, reviewer: null, reviewedAt: null });
  assert.equal(dataset.recoveredBindingCount, 522);
  assert.equal(dataset.baseVerifiedBindingCount, 3170);
  assert.equal(dataset.packetCount, 156);
  assert.deepEqual(dataset.classificationCounts, {
    pending_title_only: 306,
    indirect_pending_title_rebind: 2,
    exact_verified_rebind: 52,
    collateral_original_after_bad_alias_quarantine: 140,
    extended_exact_evidence: 22,
  });
  const bindings = dataset.packets.flatMap((packet) => packet.entries);
  assert.equal(bindings.length, 522);
  assert.equal(new Set(bindings.map((entry) => entry.bindingKey)).size, 522);
  assert.equal(new Set(bindings.map((entry) => entry.entrySha256)).size, 522);
  assert.equal(JSON.stringify(bindings).includes("cd-135x135"), false);
  assert.ok(bindings.every((entry) => entry.entryReviewState === "pending_review"));
});

test("rendered page is inspection-only and contains every binding row", async () => {
  const { plan, supplement } = await inputs();
  const dataset = buildTemplateResolutionReviewDataset({ plan, supplement });
  const outputPath = path.join(REVIEW_DIRECTORY, "template-resolution-review.html");
  const html = renderTemplateResolutionReviewHtml(dataset, {
    runDirectory: RUN_DIRECTORY,
    outputPath,
    verifiedEvidence: [],
  });
  assert.match(html, /KUN LÆSNING/);
  assert.match(html, /Denne HTML kan ikke ændre status/);
  assert.equal((html.match(/data-binding-row/g) || []).length, 522);
  assert.equal((html.match(/<article class="packet" data-review-packet/g) || []).length, 156);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest|WebSocket|supabase/i);
  assert.doesNotMatch(html, /data-action=["']approve/i);
});

test("generator verifies the plan sidecar and all displayed evidence without writing", async () => {
  const result = await generateTemplateResolutionReview({
    runDirectory: RUN_DIRECTORY,
    writeOutput: false,
  });
  assert.equal(result.packetCount, 156);
  assert.equal(result.recoveredBindingCount, 522);
  assert.equal(result.verifiedEvidenceFileCount, 175);
  assert.equal(result.approvalChanged, false);
  assert.equal(result.databaseWrites, false);
  assert.equal(result.networkRequests, false);
  assert.match(result.outputSha256, /^[a-f0-9]{64}$/);
});

test("dataset builder fails closed if a pending plan is marked approved", async () => {
  const { plan, supplement } = await inputs();
  const approved = structuredClone(plan);
  approved.reviewState = "approved";
  approved.approval = {
    approved: true,
    reviewer: "test-reviewer",
    reviewedAt: "2026-08-31T12:00:00.000Z",
  };
  assert.throws(
    () => buildTemplateResolutionReviewDataset({ plan: approved, supplement }),
    /only accepts a pending plan/
  );
});
