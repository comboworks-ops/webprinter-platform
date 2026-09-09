const BROWSER_EXTENSION_PROTOCOLS = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "ms-browser-extension://",
] as const;

const includesBrowserExtensionProtocol = (value: unknown) => {
  const normalized = String(value || "").toLowerCase();
  return BROWSER_EXTENSION_PROTOCOLS.some((protocol) => normalized.includes(protocol));
};

export const isBrowserExtensionRuntimeError = (reason: unknown, sourceUrl?: string) => {
  const stack = (reason as { stack?: unknown } | null)?.stack;
  return includesBrowserExtensionProtocol(sourceUrl) || includesBrowserExtensionProtocol(stack);
};

/** The browser defers remaining observations to the next rendering loop. This
 * message-only ErrorEvent is not a thrown application exception.
 * https://www.w3.org/TR/resize-observer/#deliver-resize-error */
export const isResizeObserverDeliveryNotification = (
  event: Pick<ErrorEvent, "message" | "error" | "filename" | "lineno" | "colno">,
) => event.message === "ResizeObserver loop completed with undelivered notifications."
  && event.error == null
  && event.filename === ""
  && event.lineno === 0
  && event.colno === 0;
