import assert from "node:assert/strict";
import test from "node:test";

import { getSiteCheckoutDesignSignature, readSiteCheckoutSession, writeSiteCheckoutSession, stageSiteCheckoutTransfer, consumeSiteCheckoutTransfer } from "./siteCheckoutSession.ts";

test("checkout design signature changes when a template becomes professional-upload-only", () => {
  const base = {
    productId: "sales-folder",
    selectedVariant: "A4 / 5 mm / guld-folie",
    templatePdfUrl: "https://example.test/folder-template.pdf",
    templatePdfSha256: "a".repeat(64),
  };

  const designerSignature = getSiteCheckoutDesignSignature({
    ...base,
    templateArtworkMode: "online_designer",
  });
  const professionalUploadSignature = getSiteCheckoutDesignSignature({
    ...base,
    templateArtworkMode: "professional_pdf_upload_only",
    templateArtworkModeReasonDa: "Staffagefarve kræves.",
  });

  assert.notEqual(professionalUploadSignature, designerSignature);
  assert.match(professionalUploadSignature, /professional_pdf_upload_only/);
  assert.match(professionalUploadSignature, /Staffagefarve/);
});

test("large-format dimensions and charged component identities survive checkout and Designer transfer", () => {
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  const previous = ["window", "sessionStorage", "localStorage"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    window: {value: {}, configurable: true},
    sessionStorage: {value: storage(session), configurable: true},
    localStorage: {value: storage(local), configurable: true},
  });
  try {
    const state = {productId: "large-format", pricingQuote: {quantity: 3, storformat: {
      widthMm: 1250, heightMm: 730, materialId: "material-1", finishIds: ["laminate", "cut"],
      productIds: ["mount"], selectedSectionValues: {material: "material-1", finish: "laminate", cutting: "cut", assembly: "mount"},
    }}};
    assert.equal(writeSiteCheckoutSession(state), true);
    assert.deepEqual(readSiteCheckoutSession(), state);
    assert.equal(stageSiteCheckoutTransfer(state), true);
    assert.deepEqual(consumeSiteCheckoutTransfer(), state);
    assert.equal(consumeSiteCheckoutTransfer(), null);
    const changed = structuredClone(state);
    changed.pricingQuote.storformat.finishIds.pop();
    assert.notEqual(getSiteCheckoutDesignSignature(changed), getSiteCheckoutDesignSignature(state));
    changed.pricingQuote.storformat = {...state.pricingQuote.storformat, widthMm: 1300};
    assert.notEqual(getSiteCheckoutDesignSignature(changed), getSiteCheckoutDesignSignature(state));
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
