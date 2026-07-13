import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeCompanyAssetFileName,
  validateCompanyAssetFile,
} from "./assetService.ts";

test("accepts print-ready PDF and image files", () => {
  assert.doesNotThrow(() => validateCompanyAssetFile({ name: "visitkort.pdf", type: "application/pdf", size: 2048 } as File));
  assert.doesNotThrow(() => validateCompanyAssetFile({ name: "logo.ai", type: "", size: 2048 } as File));
});

test("rejects oversized and unsupported assets", () => {
  assert.throws(
    () => validateCompanyAssetFile({ name: "stor.pdf", type: "application/pdf", size: 26 * 1024 * 1024 } as File),
    /25 MB/,
  );
  assert.throws(
    () => validateCompanyAssetFile({ name: "program.exe", type: "application/octet-stream", size: 1024 } as File),
    /PDF, AI, EPS/,
  );
});

test("storage file names are stable and ASCII-safe", () => {
  assert.equal(sanitizeCompanyAssetFileName("Mæglerens salgsopstilling #1.pdf"), "M-glerens-salgsopstilling-1.pdf");
});
