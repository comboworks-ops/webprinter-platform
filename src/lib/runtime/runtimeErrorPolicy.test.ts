import assert from "node:assert/strict";
import test from "node:test";

import { isBrowserExtensionRuntimeError, isResizeObserverDeliveryNotification } from "./runtimeErrorPolicy.ts";

const resizeDeliveryEvent = {
  message: "ResizeObserver loop completed with undelivered notifications.",
  error: null,
  filename: "",
  lineno: 0,
  colno: 0,
};

test("native ResizeObserver delivery notifications are nonfatal layout diagnostics", () => {
  assert.equal(isResizeObserverDeliveryNotification(resizeDeliveryEvent), true);
});

test("a thrown application Error remains fatal even with the ResizeObserver notification message", () => {
  assert.equal(isResizeObserverDeliveryNotification({ ...resizeDeliveryEvent, error: new Error(resizeDeliveryEvent.message) }), false);
  assert.equal(isResizeObserverDeliveryNotification({ ...resizeDeliveryEvent, filename: "http://localhost/src/app.ts", lineno: 42, colno: 3 }), false);
});

test("other window failures and loosely similar resize errors are not suppressed", () => {
  for (const message of ["Script error.", "ResizeObserver is not defined", "ResizeObserver callback failed", `${resizeDeliveryEvent.message} App callback failed`]) {
    assert.equal(isResizeObserverDeliveryNotification({ ...resizeDeliveryEvent, message }), false);
  }
});

test("browser extension promise failures are treated as external noise", () => {
  const extensionError = Object.assign(new Error("Failed to connect to MetaMask"), {
    stack: [
      "Error: Failed to connect to MetaMask",
      "    at connect (chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/scripts/inpage.js:7:84292)",
    ].join("\n"),
  });

  assert.equal(isBrowserExtensionRuntimeError(extensionError), true);
});

test("browser extension window errors are recognized from their source URL", () => {
  assert.equal(
    isBrowserExtensionRuntimeError(new Error("Script error"), "moz-extension://example/content.js"),
    true,
  );
});

test("application failures remain fatal even when their message mentions MetaMask", () => {
  const applicationError = Object.assign(new Error("Failed to connect to MetaMask"), {
    stack: "Error: Failed to connect to MetaMask\n    at connect (http://127.0.0.1:8101/src/auth.ts:10:5)",
  });

  assert.equal(isBrowserExtensionRuntimeError(applicationError), false);
});
