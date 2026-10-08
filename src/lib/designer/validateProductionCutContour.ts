import type { fabric } from 'fabric';
import { inspectPdfCutContours } from './pdfCutContourInspection.ts';
import { contourObjects, isSingleClosedContour, SINGLE_CUT_CONTOUR_MESSAGE, cutContourGeometrySignature } from './cutContourValidation.ts';
import { assertCutContourRequirements, type CutContourRequirements } from './cutContourRequirements.ts';
import { inspectPdfCutContourProduction } from './pdfCutContourProductionInspection.ts';

type ContourCanvasObject = fabric.Object & { __isGuide?: boolean; data?: { kind?: string; originalPdfBytes?: ArrayBuffer; pageIndex?: number; templateUrl?: string; geometrySignature?: string } };
/** Decode real PDF resources/streams, including compressed objects and forms. */
export async function embeddedPdfHasSingleClosedContour(bytes: ArrayBuffer, pageIndex: number): Promise<boolean> {
  const result = await inspectPdfCutContours(bytes, pageIndex);
  return result.valid && result.paths === 1;
}
export async function validateProductionCutContour(canvas: Pick<fabric.Canvas, 'getObjects'>, presetTemplateUrl?: string | null, requirements?: CutContourRequirements) {
  if (requirements) assertCutContourRequirements(requirements);
  const objects = (canvas.getObjects() as ContourCanvasObject[]).filter(object => object.visible !== false && !object.__isGuide);
  const contours = contourObjects(objects);
  const importedPdfs = objects.filter(object => object.data?.kind === 'pdf_page_background' && object.data.originalPdfBytes);
  const inspected = await Promise.all(importedPdfs.map(async object => ({ object, result: await inspectPdfCutContours(object.data!.originalPdfBytes!, object.data!.pageIndex || 0) })));
  if (inspected.some(item => !item.result.valid)) throw new Error('PDF-skærelinjen kunne ikke kontrolleres. Brug en klargjort PDF eller en separat SVG-skærelinje.');
  const pdfs = inspected.filter(item => item.result.paths > 0).map(item => item.object);
  if (contours.length + pdfs.length !== 1 || contours.some(object => !isSingleClosedContour(object))) throw new Error(SINGLE_CUT_CONTOUR_MESSAGE);
  for (const contour of contours as ContourCanvasObject[]) {
    const data = contour.data;
    if ((presetTemplateUrl || data?.kind === 'preset_cut_contour') && (data?.kind !== 'preset_cut_contour' || (presetTemplateUrl && data.templateUrl !== presetTemplateUrl) || data.geometrySignature !== cutContourGeometrySignature(contour))) {
      throw new Error('Skærelinjen skal følge den valgte form og størrelse. Gendan produktets skabelon før eksport.');
    }
  }
  if (presetTemplateUrl && contours.length !== 1) throw new Error('Produktets faste skæreform skal bevares.');
  for (const pdf of pdfs) {
    const data = pdf.data;
    if (!await embeddedPdfHasSingleClosedContour(data.originalPdfBytes, data.pageIndex || 0)) throw new Error(SINGLE_CUT_CONTOUR_MESSAGE);
    if (requirements) {
      const result = await inspectPdfCutContourProduction(data.originalPdfBytes, data.pageIndex || 0, requirements);
      if (!result.valid || result.paths !== 1) throw new Error('PDF-skærelinjen opfylder ikke produktets krav til spotfarve, stregbredde, separat lag og overprint.');
    }
  }
}
