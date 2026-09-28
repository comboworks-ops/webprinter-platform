
export type FileTransferProgress = {
  phase: 'preparing' | 'uploading' | 'verifying';
  loaded: number;
  total: number;
};

export function storageUploadEndpoint(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  if (/^[a-z0-9]+\.supabase\.co$/.test(url.hostname)) {
    url.hostname = url.hostname.replace('.supabase.co', '.storage.supabase.co');
  }
  url.pathname = '/storage/v1/upload/resumable';
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** Chunk retries stay on the same immutable object and never retain credentials on disk. */
export async function resumableUpload(options: {
  supabaseUrl: string; bucket: string; path: string; file: Blob;
  headers: Record<string, string>;
  onProgress?: (progress: FileTransferProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const {Upload} = await import('tus-js-client');
  return new Promise((resolve, reject) => {
    const endpoint = storageUploadEndpoint(options.supabaseUrl);
    let settled = false;
    let requestDeadline: ReturnType<typeof setTimeout>;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(requestDeadline);
      options.signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve();
    };
    const resetDeadline = () => {
      clearTimeout(requestDeadline);
      requestDeadline = setTimeout(() => {
        finish(new Error('Uploaden svarer ikke. Kontrollér forbindelsen og prøv igen.'));
        void upload.abort();
      }, 120_000);
    };
    const upload = new Upload(options.file, {
      endpoint,
      headers: options.headers,
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      storeFingerprintForResuming: false,
      uploadDataDuringCreation: true,
      metadata: { bucketName: options.bucket, objectName: options.path,
        contentType: options.file.type || 'application/octet-stream', cacheControl: '3600' },
      onBeforeRequest(request) {
        // Never forward the signed token to a foreign Location returned by a proxy.
        if (new URL(request.getURL()).origin !== new URL(endpoint).origin) {
          throw new Error('Ugyldigt uploadlink.');
        }
        // tus-js-client does not handle native XHR timeout events. Own the
        // inactivity deadline so a timeout always releases the upload UI.
        resetDeadline();
      },
      onAfterResponse: () => clearTimeout(requestDeadline),
      onProgress: (loaded, total) => { resetDeadline(); options.onProgress?.({phase: 'uploading', loaded, total}); },
      onError: () => finish(new Error('Trykfilen kunne ikke uploades. Kontrollér forbindelsen og prøv igen.')),
      onSuccess: () => finish(),
    });
    const cancel = () => {
      void upload.abort();
      finish(new DOMException('Upload annulleret', 'AbortError'));
    };
    if (options.signal?.aborted) { cancel(); return; }
    options.signal?.addEventListener('abort', cancel, {once: true});
    upload.start();
  });
}
