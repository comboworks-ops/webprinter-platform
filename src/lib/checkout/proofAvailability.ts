export type CheckoutProofAvailabilityInput = {
  hasFile: boolean;
  hasPreview: boolean;
  processing: boolean;
  approved: boolean;
  hasLocalCheck: boolean;
  designerExport: boolean;
  hasIssues: boolean;
  needsExport: boolean;
};

export function getCheckoutProofAvailability(input: CheckoutProofAvailabilityInput) {
  const canReview = input.hasFile && input.hasPreview && !input.processing;
  // Restored uploads have a preview but no in-memory check result. Keep manual
  // review available without claiming those files passed checks in this session.
  const requiresModalReview = input.hasIssues || input.needsExport
    || (!input.hasLocalCheck && !input.designerExport);
  return {
    canReview,
    requiresModalReview,
    quickApproveAvailable: canReview && !input.approved && !requiresModalReview,
  };
}
