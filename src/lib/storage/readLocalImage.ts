/** Resolve a small selected image before starting a network upload.
 * Cloud-backed file pickers can return a File while its bytes are still unavailable.
 */
export function readLocalImage(file: File, timeoutMs = 20_000): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const unavailable = () => new Error('Filen kan ikke læses fra denne Mac. Hent den fra iCloud eller dit skydrev i Finder, og vælg den igen.');
    const finish = (result?: ArrayBuffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result) resolve(new File([result], file.name, { type: file.type, lastModified: file.lastModified }));
      else reject(unavailable());
    };
    reader.onload = () => finish(reader.result instanceof ArrayBuffer ? reader.result : undefined);
    reader.onerror = () => finish();
    reader.onabort = () => finish();
    const timer = setTimeout(() => {
      finish();
      reader.abort();
    }, timeoutMs);
    try { reader.readAsArrayBuffer(file); }
    catch { finish(); }
  });
}
