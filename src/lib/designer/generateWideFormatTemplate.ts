import { PDFDocument, PDFName, PDFOperator, PDFOperatorNames, setLineJoin, LineJoinStyle, LineCapStyle, rgb } from 'pdf-lib';
import { readWideFormatTemplate } from './wideFormatGeometry.js';

/** Geometry is regenerated; fixed physical offsets are never scaled with the source. */
export async function generateWideFormatTemplate(url: string): Promise<Uint8Array> {
  const config = readWideFormatTemplate(url);
  if (!config) throw new Error('Ugyldig størrelse eller form til skabelonen.');
  const { shape, widthMm: w, heightMm: h } = config;
  const pt = 72 / 25.4, bleed = 3;
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date('2026-10-01T00:00:00Z'));
  pdf.setModificationDate(new Date('2026-10-01T00:00:00Z'));
  pdf.setProducer('Webprinter size template v1');
  const page = pdf.addPage([(w + 2 * bleed) * pt, (h + 2 * bleed) * pt]);
  page.setTrimBox(bleed * pt, bleed * pt, w * pt, h * pt);
  page.setArtBox(bleed * pt, bleed * pt, w * pt, h * pt);
  page.setBleedBox(0, 0, (w + 6) * pt, (h + 6) * pt);
  page.setCropBox(0, 0, (w + 6) * pt, (h + 6) * pt);
  const group = pdf.context.register(pdf.context.obj({ Type: 'OCG', Name: 'Hjælpelinjer - ikke til tryk', Usage: { View: { ViewState: 'ON' }, Print: { PrintState: 'OFF' }, Export: { ExportState: 'OFF' } } }));
  const properties = pdf.context.obj({ Guide: group });
  page.node.Resources()!.set(PDFName.of('Properties'), properties);
  pdf.catalog.set(PDFName.of('OCProperties'), pdf.context.obj({ OCGs: [group], D: { ON: [group], Order: [group], AS: ['View', 'Print', 'Export'].map(Event => ({ Event, OCGs: [group], Category: [Event] })) } }));
  // Round PDF strokes form exact distance bands around the actual vector curve.
  // The unpainted/green core is >=3 mm inside the cut; pink extends 3 mm
  // outside and inside it. Narrow details naturally have no green safe core.
  const path = shape.path || `M0 0 L1 0 L1 ${h / w} L0 ${h / w} Z`;
  // Use drawSvgPath's vector operators inside a single non-printing OCG.
  page.pushOperators(PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of('OC'), PDFName.of('Guide')]));
  page.pushOperators(setLineJoin(LineJoinStyle.Round));
  const placement = { x: 3 * pt, y: (h + 3) * pt, scale: w * pt };
  page.drawSvgPath(path, { ...placement, color: rgb(0.9, 0.97, 1), borderColor: rgb(1, 0.9, 0.93), borderWidth: 6 / w, borderLineCap: LineCapStyle.Round });
  page.drawSvgPath(path, { ...placement, borderColor: rgb(0.85, 0, 0.5), borderWidth: 0.5 / (w * pt), borderDashArray: [3 / (w * pt), 2 / (w * pt)] });
  if (shape.kind === 'rectangle' && w > 6 && h > 6) page.drawRectangle({ x: 6 * pt, y: 6 * pt, width: (w - 6) * pt, height: (h - 6) * pt, borderWidth: 0.5, borderColor: rgb(0.1, 0.5, 0.9) });
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
  return pdf.save();
}
