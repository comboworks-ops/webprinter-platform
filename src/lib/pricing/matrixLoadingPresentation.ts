export type MatrixLoadingPresentationInput = {
  productId: string;
  lastPresentedProductId: string | null;
  matrixLoading: boolean;
  hasResolvedPriceRows: boolean;
};

/**
 * The large matrix skeleton is useful before the configurator is ready for the
 * first time. Once customers can interact with a product, replacing the whole
 * subtree during every price refresh causes a visible flash and scroll jump.
 */
export function shouldShowInitialMatrixSkeleton({
  productId,
  lastPresentedProductId,
  matrixLoading,
  hasResolvedPriceRows,
}: MatrixLoadingPresentationInput): boolean {
  return matrixLoading
    && !hasResolvedPriceRows
    && lastPresentedProductId !== productId;
}
