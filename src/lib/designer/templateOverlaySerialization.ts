export type CanvasJsonSnapshot = {
  objects?: unknown[];
  [key: string]: unknown;
};

export const stripPdfTemplateOverlaysFromCanvasJson = <T extends CanvasJsonSnapshot>(snapshot: T): T => {
  if (!Array.isArray(snapshot.objects)) return snapshot;

  return {
    ...snapshot,
    objects: snapshot.objects.filter((object) => {
      if (!object || typeof object !== "object") return true;
      const candidate = object as { __isPdfTemplate?: boolean; data?: { kind?: string } };
      return candidate.__isPdfTemplate !== true && candidate.data?.kind !== "pdf_template_overlay";
    }),
  } as T;
};
