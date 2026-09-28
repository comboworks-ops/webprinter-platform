import type {FileTransferProgress} from './resumableUpload.ts';

/** Standard Storage upload, with actual transfer progress and bounded failure. */
export function standardUpload(options: {
  supabaseUrl: string; bucket: string; path: string; file: Blob;
  headers: Record<string, string>; token?: string;
  onProgress?: (progress: FileTransferProgress) => void;
}): Promise<void> {
  const objectPath = [options.bucket, ...options.path.split('/')].map(encodeURIComponent).join('/');
  const url = new URL(`/storage/v1/object/${options.token ? 'upload/sign/' : ''}${objectPath}`, options.supabaseUrl);
  if (options.token) url.searchParams.set('token', options.token);
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const fail = () => reject(new Error('Filen kunne ikke uploades. Kontrollér forbindelsen og prøv igen.'));
    request.open(options.token ? 'PUT' : 'POST', url.toString());
    request.timeout = 120_000;
    for (const [name, value] of Object.entries(options.headers)) request.setRequestHeader(name, value);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = event => {
      if (event.lengthComputable) options.onProgress?.({phase: 'uploading', loaded: Math.min(options.file.size, Math.round(event.loaded / event.total * options.file.size)), total: options.file.size});
    };
    request.onerror = fail;
    request.ontimeout = fail;
    request.onabort = fail;
    request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : fail();
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', options.file);
    options.onProgress?.({phase: 'uploading', loaded: 0, total: options.file.size});
    request.send(body);
  });
}
