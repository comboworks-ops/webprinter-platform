import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFString, PDFPage } from 'pdf-lib';

export type AffineMatrix = [number, number, number, number, number, number];
export function multiplyAffine(a: AffineMatrix, b: AffineMatrix): AffineMatrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}

/** Map an unrotated PDF crop (bottom-left origin) to the PDF.js thumbnail's
 * centered Fabric rectangle (top-left origin), including the page's /Rotate.
 */
export function pdfPageToObjectMatrix(cropWidth: number, cropHeight: number, objectWidth: number, objectHeight: number, angle: number): AffineMatrix {
  if (![cropWidth, cropHeight, objectWidth, objectHeight].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid imported PDF dimensions');
  const rotation = ((angle % 360) + 360) % 360;
  if (rotation === 0) return [objectWidth / cropWidth, 0, 0, -objectHeight / cropHeight, -objectWidth / 2, objectHeight / 2];
  if (rotation === 90) return [0, objectHeight / cropWidth, objectWidth / cropHeight, 0, -objectWidth / 2, -objectHeight / 2];
  if (rotation === 180) return [-objectWidth / cropWidth, 0, 0, objectHeight / cropHeight, objectWidth / 2, -objectHeight / 2];
  if (rotation === 270) return [0, -objectHeight / cropWidth, -objectWidth / cropHeight, 0, objectWidth / 2, objectHeight / 2];
  throw new Error('Unsupported PDF page rotation');
}

export function importedVisibleBox(page: PDFPage) {
  const media = page.getMediaBox(), crop = page.getCropBox();
  const left = Math.max(media.x, crop.x), bottom = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width), top = Math.min(media.y + media.height, crop.y + crop.height);
  if (right <= left || top <= bottom) throw new Error('Den importerede PDF har en tom CropBox.');
  return { left, bottom, right, top };
}

export function productionRasterScale(width: number, height: number, pixelsPerMm: number, maxTrimMm: number) {
  if (![width, height, pixelsPerMm, maxTrimMm].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid raster bounds');
  const targetPpi = maxTrimMm > 2000 ? 100 : maxTrimMm > 1000 ? 150 : 300;
  const multiplier = Math.min(targetPpi / (25.4 * pixelsPerMm), 8192 / width, 8192 / height, Math.sqrt(32_000_000 / (width * height)));
  return { multiplier, targetPpi, effectivePpi: multiplier * pixelsPerMm * 25.4 };
}

export function setProductionPageBoxes(page: PDFPage, widthMm: number, heightMm: number, bleedMm: number) {
  const pt = 72 / 25.4;
  page.setBleedBox(0, 0, (widthMm + 2 * bleedMm) * pt, (heightMm + 2 * bleedMm) * pt);
  page.setTrimBox(bleedMm * pt, bleedMm * pt, widthMm * pt, heightMm * pt);
}

/** An OutputIntent describes a target. This does not declare or certify PDF/X. */
export function addProductionOutputIntent(pdf: PDFDocument, profile: { name: string; bytes: ArrayBuffer }) {
  const icc = pdf.context.register(pdf.context.flateStream(new Uint8Array(profile.bytes), { N: 4, Alternate: 'DeviceCMYK' }));
  const intent = pdf.context.register(pdf.context.obj({ Type: 'OutputIntent', S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of(profile.name), Info: PDFString.of(profile.name), DestOutputProfile: icc }));
  pdf.catalog.set(PDFName.of('OutputIntents'), pdf.context.obj([intent]));
  return icc;
}

/** Preserve the source's numeric device colors inside its embedded Form, even when the destination has a different intent. */
export function preserveImportedOutputIntent(source: PDFDocument, sourcePage: PDFPage): string | null {
  const intents = source.catalog.lookupMaybe(PDFName.of('OutputIntents'), PDFArray);
  if (!intents?.size()) return null;
  const intent = intents.lookup(0, PDFDict);
  const profileRef = intent.get(PDFName.of('DestOutputProfile'));
  if (!profileRef) throw new Error('Den importerede PDF har en output intent uden ICC-data.');
  const stream = source.context.lookup(profileRef);
  if (!(stream instanceof PDFRawStream)) throw new Error('Den importerede PDF har en ugyldig ICC-profil.');
  const channels = stream.dict.get(PDFName.of('N'))?.toString();
  const key = channels === '4' ? 'DefaultCMYK' : channels === '3' ? 'DefaultRGB' : channels === '1' ? 'DefaultGray' : null;
  if (!key) throw new Error('Den importerede PDFs farveprofil har et ikke-understøttet kanalantal.');
  applyDefaultProfile(source, sourcePage.node.normalizedEntries().Resources, key, profileRef);
  const identifier = intent.get(PDFName.of('OutputConditionIdentifier'));
  return identifier instanceof PDFString ? identifier.decodeText() : 'Original ICC';
}

function applyDefaultProfile(source: PDFDocument, resources: PDFDict, key: string, profileRef: any, visited = new Set<PDFDict>()) {
  if (visited.has(resources)) return;
  visited.add(resources);
  let colorSpaces = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict);
  if (!colorSpaces) { colorSpaces = source.context.obj({}); resources.set(PDFName.of('ColorSpace'), colorSpaces); }
  if (!colorSpaces.has(PDFName.of(key))) colorSpaces.set(PDFName.of(key), source.context.obj([PDFName.of('ICCBased'), profileRef]));
  const xObjects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
  for (const [, ref] of xObjects?.entries() || []) {
    const form = source.context.lookup(ref);
    if (!(form instanceof PDFRawStream) || form.dict.get(PDFName.of('Subtype'))?.toString() !== '/Form') continue;
    const children = form.dict.lookupMaybe(PDFName.of('Resources'), PDFDict);
    if (children) applyDefaultProfile(source, children, key, profileRef, visited);
  }
}

export function tagGeneratedRgbPage(source: PDFDocument, page: PDFPage, srgb: Uint8Array) {
  const profile = source.context.register(source.context.flateStream(srgb, { N: 3, Alternate: 'DeviceRGB' }));
  applyDefaultProfile(source, page.node.normalizedEntries().Resources, 'DefaultRGB', profile);
}

/** Embed raw CMYK (or explicitly tagged sRGB) samples, retaining alpha as a soft mask. */
export function embedProductionRaster(pdf: PDFDocument, width: number, height: number, pixels: Uint8Array, alpha: Uint8Array, profileRef: any, channels: 3 | 4) {
  if (pixels.length !== width * height * channels || alpha.length !== width * height) throw new Error('Raster sample count mismatch');
  const mask = alpha.some(a => a !== 255)
    ? pdf.context.register(pdf.context.flateStream(alpha, { Type: 'XObject', Subtype: 'Image', Width: width, Height: height, ColorSpace: 'DeviceGray', BitsPerComponent: 8 })) : undefined;
  return pdf.context.register(pdf.context.flateStream(pixels, {
    Type: 'XObject', Subtype: 'Image', Width: width, Height: height,
    ColorSpace: profileRef ? [PDFName.of('ICCBased'), profileRef] : channels === 4 ? 'DeviceCMYK' : 'DeviceRGB', BitsPerComponent: 8,
    Interpolate: false, ...(mask ? { SMask: mask } : {}),
  }));
}
