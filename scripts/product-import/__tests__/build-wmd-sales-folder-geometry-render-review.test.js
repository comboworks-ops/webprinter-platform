import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GeometryRenderReviewError,
  buildGeometryRenderReview,
  collectUniqueRenderPairs,
} from "../build-wmd-sales-folder-geometry-render-review.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sourcePdf(label) {
  return Buffer.from(`%PDF-1.7\n${label}\n%%EOF\n`, "utf8");
}

function entry({ sourceBytes, counterpartBytes, sourcePath, counterpartPath, bindingKey, finishKey = "none" }) {
  const sourceSha256 = sha256(sourceBytes);
  const counterpartSha256 = sha256(counterpartBytes);
  return {
    sourceTemplateSha256: sourceSha256,
    expectedGeometry: {
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 5,
    },
    finishKey,
    coveredBindingKeys: [bindingKey],
    sourceTemplate: {
      sourceUrl: "https://www.wir-machen-druck.de/source.pdf",
      localRelativePath: sourcePath,
      sha256: sourceSha256,
    },
    verifiedWindowCounterpart: {
      sourceUrl: "https://www.wir-machen-druck.de/counterpart.pdf",
      localRelativePath: counterpartPath,
      sha256: counterpartSha256,
      geometry: {
        format: "a4",
        construction: "2-part-2-flaps-window",
        print: "4+0",
        spine: 5,
      },
    },
    comparisons: {},
    renderedReviewEvidence: {
      status: "pending_review",
      sourceRenderSha256s: [],
      counterpartRenderSha256s: [],
      sourceHasWindowCut: null,
      counterpartHasWindowCut: null,
      reviewerNote: "",
    },
    verdict: "title_only_construction_text_error",
  };
}

function supplement(entries, reviewState = "pending_review") {
  return {
    kind: "wmd_sales_folder_geometry_supplement",
    schemaVersion: 1,
    reviewState,
    entries,
    prohibitedActionsPerformed: {
      sourcePdfModified: false,
      sourcePdfSanitized: false,
      sourcePdfUploaded: false,
      databaseWritten: false,
      published: false,
    },
  };
}

async function fixture(runDirectory, { reviewState = "pending_review", badSourceHash = false } = {}) {
  const sourceBytes = sourcePdf("SOURCE");
  const counterpartBytes = sourcePdf("COUNTERPART");
  const sourceOne = "documents/source-pdfs/z-source.pdf";
  const sourceTwo = "documents/source-pdfs/a-source.pdf";
  const counterpartOne = "documents/source-pdfs/z-counterpart.pdf";
  const counterpartTwo = "documents/source-pdfs/a-counterpart.pdf";
  await fs.mkdir(path.join(runDirectory, "documents/source-pdfs"), { recursive: true });
  await fs.mkdir(path.join(runDirectory, "review"), { recursive: true });
  for (const relativePath of [sourceOne, sourceTwo]) {
    await fs.writeFile(path.join(runDirectory, relativePath), badSourceHash ? sourcePdf("WRONG") : sourceBytes);
  }
  for (const relativePath of [counterpartOne, counterpartTwo]) {
    await fs.writeFile(path.join(runDirectory, relativePath), counterpartBytes);
  }
  const entries = [
    entry({
      sourceBytes,
      counterpartBytes,
      sourcePath: sourceOne,
      counterpartPath: counterpartOne,
      bindingKey: "binding-2",
      finishKey: "matt-lamination",
    }),
    entry({
      sourceBytes,
      counterpartBytes,
      sourcePath: sourceTwo,
      counterpartPath: counterpartTwo,
      bindingKey: "binding-1",
      finishKey: "none",
    }),
  ];
  const report = supplement(entries, reviewState);
  await fs.writeFile(
    path.join(runDirectory, "review/template-geometry-supplement.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  return { report, sourceBytes, counterpartBytes };
}

function fakePdftoppm() {
  const calls = [];
  const runner = async (command, args) => {
    calls.push({ command, args });
    if (args.length === 1 && args[0] === "-v") {
      return { code: 0, stdout: "", stderr: "pdftoppm version 99.1.0\n" };
    }
    assert.deepEqual(args.slice(0, 3), ["-png", "-r", "96"]);
    const outputPrefix = args[4];
    for (const pageNumber of [1, 2]) {
      const bytes = Buffer.concat([
        PNG_SIGNATURE,
        Buffer.from(`${path.basename(outputPrefix)}:${pageNumber}`, "utf8"),
      ]);
      await fs.writeFile(`${outputPrefix}-${pageNumber}.png`, bytes);
    }
    return { code: 0, stdout: "", stderr: "" };
  };
  return { calls, runner };
}

test("unique render pairs are byte-identity based and select paths deterministically", () => {
  const sourceBytes = sourcePdf("SOURCE");
  const counterpartBytes = sourcePdf("COUNTERPART");
  const report = supplement([
    entry({
      sourceBytes,
      counterpartBytes,
      sourcePath: "documents/source-pdfs/z.pdf",
      counterpartPath: "documents/source-pdfs/z-window.pdf",
      bindingKey: "binding-2",
      finishKey: "matt-lamination",
    }),
    entry({
      sourceBytes,
      counterpartBytes,
      sourcePath: "documents/source-pdfs/a.pdf",
      counterpartPath: "documents/source-pdfs/a-window.pdf",
      bindingKey: "binding-1",
      finishKey: "none",
    }),
  ]);
  const pairs = collectUniqueRenderPairs(report);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].pairId, "pair-001");
  assert.equal(pairs[0].sourceRelativePath, "documents/source-pdfs/a.pdf");
  assert.equal(pairs[0].counterpartRelativePath, "documents/source-pdfs/a-window.pdf");
  assert.deepEqual(pairs[0].coveredBindingKeys, ["binding-1", "binding-2"]);
  assert.deepEqual(pairs[0].finishKeys, ["matt-lamination", "none"]);
  assert.equal(pairs[0].entrySha256s.length, 2);
});

test("render pack records deterministic pdftoppm provenance and stays pending review", async (t) => {
  const roots = [];
  t.after(async () => Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true }))));
  const outputs = [];
  for (let index = 0; index < 2; index += 1) {
    const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-render-review-test-"));
    roots.push(runDirectory);
    await fixture(runDirectory);
    const fake = fakePdftoppm();
    const result = await buildGeometryRenderReview({
      runDirectory,
      rendererBinary: "fake-pdftoppm",
      expectedPairs: 1,
      processRunner: fake.runner,
    });
    assert.equal(result.reviewState, "pending_human_review");
    assert.equal(result.counts.uniquePairs, 1);
    assert.equal(result.counts.renderedPages, 4);
    assert.equal(fake.calls.length, 3);

    const outputDirectory = path.join(runDirectory, "review/template-geometry-render-review");
    const manifestBytes = await fs.readFile(path.join(outputDirectory, "render-manifest.json"));
    const htmlBytes = await fs.readFile(path.join(outputDirectory, "index.html"));
    const checksumsBytes = await fs.readFile(path.join(outputDirectory, "checksums.sha256"));
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.reviewDecision.status, "not_recorded");
    assert.equal(manifest.reviewDecision.reviewer, null);
    assert.equal(manifest.prohibitedActionsPerformed.supplementApprovalRecorded, false);
    assert.equal(manifest.renderer.tool, "pdftoppm");
    assert.equal(manifest.renderer.version, "pdftoppm version 99.1.0");
    assert.deepEqual(manifest.pairs[0].sourceRender.renderer.args, [
      "-png",
      "-r",
      "96",
      "<run>/documents/source-pdfs/a-source.pdf",
      "<output>/pair-001-source",
    ]);
    assert.equal(manifest.pairs[0].sourceRender.input.sha256, sha256(sourcePdf("SOURCE")));
    assert.equal(manifest.pairs[0].sourceRender.outputs.length, 2);
    assert.match(htmlBytes.toString("utf8"), /Afventer menneskelig kontrol/);
    assert.match(htmlBytes.toString("utf8"), /Kilde: uden vindue/);
    assert.match(checksumsBytes.toString("utf8"), /render-manifest\.json/);
    outputs.push({ manifestBytes, htmlBytes, checksumsBytes });
  }
  assert.deepEqual(outputs[0].manifestBytes, outputs[1].manifestBytes);
  assert.deepEqual(outputs[0].htmlBytes, outputs[1].htmlBytes);
  assert.deepEqual(outputs[0].checksumsBytes, outputs[1].checksumsBytes);
});

test("render pack refuses approved input, pair-count drift, source hash drift, and overwrites", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-render-review-refusal-"));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));

  const approvedRun = path.join(root, "approved");
  await fixture(approvedRun, { reviewState: "approved_title_only_construction_text_error" });
  await assert.rejects(
    buildGeometryRenderReview({
      runDirectory: approvedRun,
      expectedPairs: 1,
      processRunner: fakePdftoppm().runner,
    }),
    (error) => error instanceof GeometryRenderReviewError && /pending-review/.test(error.message)
  );

  const countRun = path.join(root, "count");
  await fixture(countRun);
  await assert.rejects(
    buildGeometryRenderReview({
      runDirectory: countRun,
      expectedPairs: 23,
      processRunner: fakePdftoppm().runner,
    }),
    /Expected 23 unique pairs, found 1/
  );

  const hashRun = path.join(root, "hash");
  await fixture(hashRun, { badSourceHash: true });
  await assert.rejects(
    buildGeometryRenderReview({
      runDirectory: hashRun,
      expectedPairs: 1,
      processRunner: fakePdftoppm().runner,
    }),
    /Source PDF hash differs from supplement/
  );
  await assert.rejects(
    fs.lstat(path.join(hashRun, "review/template-geometry-render-review")),
    (error) => error?.code === "ENOENT"
  );

  const overwriteRun = path.join(root, "overwrite");
  await fixture(overwriteRun);
  const outputDirectory = path.join(overwriteRun, "review/template-geometry-render-review");
  await fs.mkdir(outputDirectory);
  await fs.writeFile(path.join(outputDirectory, "keep.txt"), "keep");
  await assert.rejects(
    buildGeometryRenderReview({
      runDirectory: overwriteRun,
      expectedPairs: 1,
      processRunner: fakePdftoppm().runner,
    }),
    /refusing to overwrite/
  );
  assert.equal(await fs.readFile(path.join(outputDirectory, "keep.txt"), "utf8"), "keep");
});
