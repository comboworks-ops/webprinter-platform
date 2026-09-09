import type { jsPDF } from 'jspdf';

/** Set explicit finishing boxes on the current jsPDF page. Inputs are millimetres. */
export function setPdfPageBoxes(doc: jsPDF, widthMm: number, heightMm: number, bleedMm: number): void {
    if (![widthMm, heightMm, bleedMm].every(Number.isFinite) || widthMm <= 0 || heightMm <= 0 || bleedMm < 0) {
        throw new Error('Invalid PDF finishing dimensions');
    }
    // jsPDF serializes these page-context boxes in PDF points, independent of its input unit.
    const pt = 72 / 25.4;
    const page = doc.getCurrentPageInfo().pageContext;
    const media = page.mediaBox;
    if (Math.abs(media.topRightX - (widthMm + 2 * bleedMm) * pt) > 0.01
        || Math.abs(media.topRightY - (heightMm + 2 * bleedMm) * pt) > 0.01) {
        throw new Error('PDF page size does not match the finishing dimensions');
    }
    page.bleedBox = { ...media };
    page.trimBox = {
        bottomLeftX: bleedMm * pt,
        bottomLeftY: bleedMm * pt,
        topRightX: (widthMm + bleedMm) * pt,
        topRightY: (heightMm + bleedMm) * pt,
    };
}
