/** Read capped API pages without mistaking a short page for end-of-list. */
export async function loadCompletePriceRows<T extends { id: string }>(
  loadPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  expectedCount: number,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<string>();
  while (rows.length < expectedCount) {
    const { data, error } = await loadPage(rows.length, rows.length + 999);
    if (error) throw error;
    if (!data?.length) throw new Error('Price list changed while loading. Please reload.');
    for (const row of data) {
      if (ids.has(row.id)) throw new Error('Price list changed while loading. Please reload.');
      ids.add(row.id);
      rows.push(row);
    }
  }
  if (rows.length !== expectedCount) throw new Error('Price list changed while loading. Please reload.');
  return rows;
}
