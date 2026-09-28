import { PDFDocument } from 'pdf-lib';

export interface ImageProofPlacement {
  targetWidthMm: number;
  targetHeightMm: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  bleedMm: number;
}

/** Bake the exact visible placement into a PDF using original image bytes.
 * The template, trim guides and safety guides are UI overlays, never artwork. */
export async function createImageProofPdf(bytes: Uint8Array, placement: ImageProofPlacement) {
  const values = Object.values(placement);
  if (!values.every(Number.isFinite) || placement.targetWidthMm <= 0 || placement.targetHeightMm <= 0
    || placement.physicalWidthMm <= 0 || placement.physicalHeightMm <= 0 || placement.scale <= 0
    || placement.bleedMm < 0 || placement.bleedMm * 2 >= Math.min(placement.targetWidthMm, placement.targetHeightMm)) {
    throw new Error('Trykfilens mål eller placering er ugyldig.');
  }
  const pdf = await PDFDocument.create();
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!png && !jpeg) throw new Error('Gem billedet som JPG eller PNG for at godkende det her.');
  const image = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const pt = 72 / 25.4;
  const pageWidth = placement.targetWidthMm * pt;
  const pageHeight = placement.targetHeightMm * pt;
  const width = placement.physicalWidthMm * pt * placement.scale / 100;
  const height = placement.physicalHeightMm * pt * placement.scale / 100;
  const page = pdf.addPage([pageWidth, pageHeight]);
  page.setBleedBox(0, 0, pageWidth, pageHeight);
  const bleed = placement.bleedMm * pt;
  page.setTrimBox(bleed, bleed, pageWidth - 2 * bleed, pageHeight - 2 * bleed);
  page.drawImage(image, {
    x: pageWidth * (0.5 + placement.offsetX / 100) - width / 2,
    y: pageHeight * (0.5 - placement.offsetY / 100) - height / 2,
    width, height,
  });
  return pdf.save();
}
