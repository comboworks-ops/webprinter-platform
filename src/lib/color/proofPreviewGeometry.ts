export interface ProofPreviewBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ProofPreviewGeometry {
    bounds: ProofPreviewBounds;
    multiplier: number;
    bitmapWidth: number;
    bitmapHeight: number;
    resolutionLimited: boolean;
}

/** Only rasterize visible artwork, at display pixel density. Never include pasteboard. */
export function computeProofPreviewGeometry(options: {
    docWidth: number;
    docHeight: number;
    pasteboardOffset: number;
    viewportTransform: readonly number[];
    viewportWidth: number;
    viewportHeight: number;
    devicePixelRatio: number;
    maxPixels?: number;
    maxDimension?: number;
}): ProofPreviewGeometry | null {
    const { docWidth, docHeight, pasteboardOffset, viewportTransform: vpt, viewportWidth, viewportHeight } = options;
    const zoom = vpt[0];
    if (![docWidth, docHeight, zoom, viewportWidth, viewportHeight, vpt[4], vpt[5]].every(Number.isFinite)
        || Math.min(docWidth, docHeight, zoom, viewportWidth, viewportHeight) <= 0) return null;
    const docLeft = vpt[4] + pasteboardOffset * zoom;
    const docTop = vpt[5] + pasteboardOffset * zoom;
    const left = Math.max(0, docLeft);
    const top = Math.max(0, docTop);
    const width = Math.min(viewportWidth, docLeft + docWidth * zoom) - left;
    const height = Math.min(viewportHeight, docTop + docHeight * zoom) - top;
    if (width <= 0 || height <= 0) return null;

    const dpr = Number.isFinite(options.devicePixelRatio) && options.devicePixelRatio > 0 ? options.devicePixelRatio : 1;
    const maxPixels = Math.max(1, options.maxPixels ?? 12_000_000);
    const maxDimension = Math.max(1, options.maxDimension ?? 8192);
    const multiplier = Math.min(dpr, Math.sqrt(maxPixels / (width * height)), maxDimension / Math.max(width, height));
    return {
        bounds: { left, top, width, height },
        multiplier,
        bitmapWidth: Math.max(1, Math.floor(width * multiplier)),
        bitmapHeight: Math.max(1, Math.floor(height * multiplier)),
        resolutionLimited: multiplier < dpr - 0.001,
    };
}

export interface ProofRequestTicket { profileRevision: number; requestId: number }

/** A profile change, zoom, or edit invalidates every in-flight frame immediately. */
export class ProofRequestGate {
    private profileRevision = 0;
    private requestId = 0;
    nextProfile(): number {
        return ++this.profileRevision;
    }
    invalidatePreview(): void { this.requestId++; }
    nextPreview(): ProofRequestTicket {
        return { profileRevision: this.profileRevision, requestId: ++this.requestId };
    }
    accepts(ticket: ProofRequestTicket): boolean {
        return ticket.profileRevision === this.profileRevision && ticket.requestId === this.requestId;
    }
    isCurrentProfile(revision: number): boolean { return revision === this.profileRevision; }
}
