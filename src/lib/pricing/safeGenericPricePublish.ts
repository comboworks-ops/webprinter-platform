export type GenericPriceConflictRow = {
  id?: string | null;
  product_id: string;
  variant_name: string;
  variant_value: string;
  quantity: number;
};

type SafeGenericPricePublishOptions<T extends GenericPriceConflictRow> = {
  existingRows: GenericPriceConflictRow[];
  desiredRows: T[];
  batchSize?: number;
  upsertBatch: (rows: T[]) => Promise<void>;
  updateProduct: () => Promise<void>;
  deleteStaleBatch: (ids: string[]) => Promise<void>;
  onProgress?: (saved: number, total: number) => void;
};

export type SafeGenericPricePublishResult = {
  saved: number;
  deletedStale: number;
};

export const getGenericPriceConflictKey = (row: GenericPriceConflictRow) => [
  row.product_id,
  row.variant_name,
  row.variant_value,
  row.quantity,
].join("|");

export const chunkRows = <T>(rows: T[], batchSize: number): T[][] => {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Batch size must be a positive integer");
  }

  const chunks: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    chunks.push(rows.slice(offset, offset + batchSize));
  }
  return chunks;
};

export async function publishGenericPricesSafely<T extends GenericPriceConflictRow>({
  existingRows,
  desiredRows,
  batchSize = 500,
  upsertBatch,
  updateProduct,
  deleteStaleBatch,
  onProgress,
}: SafeGenericPricePublishOptions<T>): Promise<SafeGenericPricePublishResult> {
  if (desiredRows.length === 0) {
    throw new Error("No price rows to save");
  }

  const desiredByKey = new Map<string, T>();
  for (const row of desiredRows) {
    desiredByKey.set(getGenericPriceConflictKey(row), row);
  }
  const deduplicatedRows = Array.from(desiredByKey.values());

  let saved = 0;
  for (const batch of chunkRows(deduplicatedRows, batchSize)) {
    await upsertBatch(batch);
    saved += batch.length;
    onProgress?.(saved, deduplicatedRows.length);
  }

  // Keep the existing storefront configuration until every desired price row
  // has been stored successfully. This avoids exposing a half-written matrix.
  await updateProduct();

  const desiredKeys = new Set(desiredByKey.keys());
  const staleIds = existingRows
    .filter((row) => !desiredKeys.has(getGenericPriceConflictKey(row)))
    .map((row) => row.id)
    .filter((id): id is string => Boolean(id));

  for (const batch of chunkRows(staleIds, batchSize)) {
    await deleteStaleBatch(batch);
  }

  return {
    saved: deduplicatedRows.length,
    deletedStale: staleIds.length,
  };
}
