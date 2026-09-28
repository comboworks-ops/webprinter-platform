type CaptureRequest = { type: string; requestId: string };
type MessageHost = {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

/** Each capture owns its listener and timer; another frame or stale response
 * cannot complete it or become an arbitrary URL fetched by the editor. */
export function requestPreviewScreenshot({ target, host, origin, timeoutMs = 10_000 }: {
  target: { postMessage(message: CaptureRequest, targetOrigin: string): void };
  host: MessageHost;
  origin: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const finish = (value: string | null) => {
      clearTimeout(timer);
      host.removeEventListener('message', onMessage);
      resolve(value);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== target || event.origin !== origin || event.data?.requestId !== requestId) return;
      if (event.data.type === 'SCREENSHOT_ERROR') finish(null);
      if (event.data.type === 'SCREENSHOT_CAPTURED') {
        const value = event.data.dataUrl;
        finish(typeof value === 'string' && value.length <= 6_000_000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    host.addEventListener('message', onMessage);
    try { target.postMessage({ type: 'CAPTURE_SCREENSHOT', requestId }, origin); }
    catch { finish(null); }
  });
}
