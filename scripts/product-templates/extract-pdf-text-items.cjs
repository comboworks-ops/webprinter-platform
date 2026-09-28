#!/usr/bin/env node

const fs = require("node:fs");
const originalConsole = { log: console.log, warn: console.warn, error: console.error };
console.log = () => {};
console.warn = () => {};
console.error = () => {};
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
console.log = originalConsole.log;
console.warn = originalConsole.warn;
console.error = originalConsole.error;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: extract-pdf-text-items.cjs /absolute/path.pdf");
  const data = new Uint8Array(fs.readFileSync(filePath));
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const text = await page.getTextContent();
    pages.push({
      page: pageNumber,
      items: text.items
        .filter((item) => String(item.str || "").trim())
        .map((item) => ({
          text: String(item.str).trim(),
          matrix: item.transform.map(Number),
          widthPt: Number(item.width || 0),
          heightPt: Number(item.height || 0),
        })),
    });
  }
  process.stdout.write(`${JSON.stringify({ pages })}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
