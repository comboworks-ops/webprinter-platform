import assert from "node:assert/strict";
import test from "node:test";

import {
  PHOTOPEA_EXPORT_MARKER,
  PHOTOPEA_MAX_INPUT_BYTES,
  PHOTOPEA_MAX_OUTPUT_DIMENSION,
  PHOTOPEA_ORIGIN,
  buildPhotopeaIframeUrl,
  buildPhotopeaOutputFileName,
  isTrustedPhotopeaMessage,
  reducePhotopeaBridge,
  sanitizePhotopeaFileName,
  validatePhotopeaPngOutput,
  validatePhotopeaSource,
} from "./photopeaBridge.ts";

test("accepts approved source formats and rejects unsafe boundaries", () => {
  assert.deepEqual(
    validatePhotopeaSource({
      byteLength: 1024,
      fileName: "kampagne.psd",
      mimeType: "image/vnd.adobe.photoshop",
    }),
    { ok: true },
  );
  assert.deepEqual(
    validatePhotopeaSource({
      byteLength: 2048,
      fileName: "vector.ai",
      mimeType: "",
    }),
    { ok: true },
  );
  assert.match(
    validatePhotopeaSource({
      byteLength: 2048,
      fileName: "payload.exe",
      mimeType: "application/octet-stream",
    }).message,
    /understøttes ikke/i,
  );
  assert.match(
    validatePhotopeaSource({
      byteLength: PHOTOPEA_MAX_INPUT_BYTES + 1,
      fileName: "large.psd",
      mimeType: "image/vnd.adobe.photoshop",
    }).message,
    /75 MB/i,
  );
});

test("builds a configuration-only Photopea URL without file or server data", () => {
  const url = buildPhotopeaIframeUrl();
  assert.ok(url.startsWith(`${PHOTOPEA_ORIGIN}#`));

  const configuration = JSON.parse(decodeURIComponent(url.slice(url.indexOf("#") + 1)));
  assert.equal(configuration.environment.localsave, false);
  assert.match(configuration.environment.customIO.save, new RegExp(PHOTOPEA_EXPORT_MARKER));
  assert.equal("files" in configuration, false);
  assert.equal("server" in configuration, false);
  assert.equal("script" in configuration, false);
});

test("requires both the exact Photopea origin and iframe window", () => {
  const expectedSource = {} as MessageEventSource;
  assert.equal(
    isTrustedPhotopeaMessage(
      { origin: PHOTOPEA_ORIGIN, source: expectedSource },
      expectedSource,
    ),
    true,
  );
  assert.equal(
    isTrustedPhotopeaMessage(
      { origin: "https://evil.example", source: expectedSource },
      expectedSource,
    ),
    false,
  );
  assert.equal(
    isTrustedPhotopeaMessage(
      { origin: PHOTOPEA_ORIGIN, source: {} as MessageEventSource },
      expectedSource,
    ),
    false,
  );
});

test("accepts only PNG output with the expected signature", () => {
  const buildPngHeader = (width: number, height: number) => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes.buffer;
  };

  const validPng = buildPngHeader(1200, 800);
  assert.deepEqual(validatePhotopeaPngOutput(validPng), { ok: true });
  assert.match(
    validatePhotopeaPngOutput(new TextEncoder().encode("not a png").buffer).message,
    /gyldig PNG/i,
  );
  assert.match(
    validatePhotopeaPngOutput(
      buildPngHeader(PHOTOPEA_MAX_OUTPUT_DIMENSION + 1, 1),
    ).message,
    /for store/i,
  );
});

test("keeps the message sequence fail-closed", () => {
  let state = { phase: "waiting-for-photopea" } as const;

  const ignoredEarlyOutput = reducePhotopeaBridge(state, { type: "photopea-output" });
  assert.equal(ignoredEarlyOutput.action, "none");

  const sendSource = reducePhotopeaBridge(state, { type: "photopea-done" });
  assert.equal(sendSource.action, "send-source");
  assert.equal(sendSource.state.phase, "loading-source");

  const ready = reducePhotopeaBridge(sendSource.state, { type: "photopea-done" });
  assert.equal(ready.state.phase, "ready");

  const exportRequest = reducePhotopeaBridge(ready.state, { type: "request-export" });
  assert.equal(exportRequest.action, "send-export-command");
  assert.equal(exportRequest.state.phase, "exporting");

  const acceptOutput = reducePhotopeaBridge(exportRequest.state, { type: "photopea-output" });
  assert.equal(acceptOutput.action, "accept-output");
  assert.equal(acceptOutput.state.phase, "ready");
});

test("normalizes output names without trusting source paths", () => {
  assert.equal(sanitizePhotopeaFileName("../../Kampagne #1.psd"), "Kampagne-1.psd");
  assert.equal(buildPhotopeaOutputFileName("../../Kampagne #1.psd"), "Kampagne-1-photopea.png");
});
