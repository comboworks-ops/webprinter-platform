import {safePdfDocumentOptions} from './pdfDocumentOptions';

/** PDF.js requests only the byte ranges needed by the preview, even for a 1 GB PDF. */
export async function openLocalPdf(file: Blob) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
  const initial = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());
  const range = new pdfjs.PDFDataRangeTransport(file.size, initial);
  const task = pdfjs.getDocument(safePdfDocumentOptions({
    range, length: file.size, disableAutoFetch: true, disableStream: true, rangeChunkSize: 1024 * 1024,
  }));
  range.requestDataRange = (begin: number, end: number) => {
    void file.slice(begin, end).arrayBuffer().then(bytes => range.onDataRange(begin, new Uint8Array(bytes)))
      .catch(() => task.destroy());
  };
  return task.promise;
}
