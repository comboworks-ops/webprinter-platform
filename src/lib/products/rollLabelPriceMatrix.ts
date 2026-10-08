import { validateRollLabelConfiguration, type RollLabelProductContract, type RollLabelSelection } from './rollLabelConfiguration';
import { rollLabelPriceSelectionKey, type RollLabelPricePoint, type RollLabelPricePreview } from './rollLabelPricePreview';
import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelGenericPriceRow = { tenant_id: string; product_id: string; variant_name: string; variant_value: string;
  quantity: number; price_dkk: number; extra_data: { rollLabels: RollLabelSelection; selectionMap: Record<string, string> } };

/** Retail amounts come from existing generic rows; the binding index is not a price fallback. */
export function rollLabelPricesFromGenericRows(packet: RollLabelPricePreview, rows: RollLabelGenericPriceRow[], tenantId: string) {
  const expected = new Map(packet.points.filter(point => point.matrix).map(point => [
    JSON.stringify([packet.productId, point.matrix!.variantName, point.matrix!.variantValue, point.selection.quantity]), point,
  ]));
  const matches = new Map<string, RollLabelPricePoint>(), ambiguous = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify([row.product_id, row.variant_name, row.variant_value, row.quantity]), point = expected.get(key);
    if (row.tenant_id !== tenantId || !point || !Number.isSafeInteger(row.price_dkk) || row.price_dkk <= 0 || !row.extra_data?.rollLabels) continue;
    try {
      if (rollLabelPriceSelectionKey(row.extra_data.rollLabels) !== rollLabelPriceSelectionKey(point.selection)
        || !Object.values(row.extra_data.selectionMap || {}).includes(point.matrix!.formatValueId)
        || !Object.values(row.extra_data.selectionMap || {}).includes(point.matrix!.variantValue)
        || !Object.values(row.extra_data.selectionMap || {}).includes(point.matrix!.contextValueId)) continue;
      if (matches.has(key) || ambiguous.has(key)) { matches.delete(key); ambiguous.add(key); continue; }
      matches.set(key, { ...point, priceDkk: row.price_dkk });
    } catch { /* Malformed or foreign rows cannot provide a displayed amount. */ }
  }
  return { ...packet, points: [...matches.values()] };
}

/** Stored draft price data is presentation only. Checkout authority is unchanged. */
export function readRollLabelPriceMatrixContract(value: unknown, contract: RollLabelProductContract | null): RollLabelPricePreview | null {
  if (!contract || !value || typeof value !== 'object') return null;
  const packet = value as RollLabelPricePreview;
  if (packet.version !== 1 || packet.productId !== contract.productId || packet.familyId !== contract.familyId
    || packet.status !== 'captured_price_proposals' || packet.currency !== 'DKK'
    || packet.commercialApproved !== false || packet.orderReady !== false || !Array.isArray(packet.points)
    || !['wmd_roll_labels_threshold_fx_7_6', 'wmd_tiered_fx_7_6'].includes(packet.ruleKey)) return null;
  const profiles = new Map(contract.profiles.map(profile => [profile.key, profile]));
  const identities = new Set<string>();
  for (const point of packet.points) {
    const s = point?.selection;
    if (!s || !Array.isArray(s.motifAllocations) || !s.sourceOptions || typeof s.sourceOptions !== 'object'
      || !Number.isSafeInteger(point.priceDkk) || point.priceDkk <= 0 || !Number.isFinite(Date.parse(point.capturedAt))) return null;
    const profile = profiles.get(s.profileKey);
    if (!profile) return null;
    if (point.matrix && (point.matrix.formatValueId !== profile.formatValueId || point.matrix.variantValue !== profile.materialValueId
      || !/^[a-f0-9-]{36}$/i.test(point.matrix.contextValueId)
      || point.matrix.variantName !== [profile.formatValueId, point.matrix.contextValueId].sort().join('|'))) return null;
    const checked = validateRollLabelConfiguration(profile, {
      dimensions: { width: String(s.widthMm), height: String(s.heightMm) }, quantity: String(s.quantity),
      allocations: s.motifAllocations.map(String), optionStateId: s.optionStateId,
    }, { productId: contract.productId, familyId: contract.familyId }).selection;
    if (!checked || rollLabelPriceSelectionKey(checked) !== rollLabelPriceSelectionKey(s)) return null;
    const key = rollLabelPriceSelectionKey(s);
    if (identities.has(key)) return null;
    identities.add(key);
  }
  return packet;
}

/** Keep each exact motif allocation on its own matrix row. Never overwrite a cell. */
export function buildRollLabelPriceMatrix(packet: RollLabelPricePreview | null, profile: RollLabelReviewProfile | null,
  selection: RollLabelSelection | null, materialLabel: string) {
  const points = packet && profile && selection && packet.productId === selection.productId && packet.familyId === selection.familyId
    ? packet.points.filter(point => point.selection.profileKey === profile.key
      && point.selection.optionStateId === selection.optionStateId && point.selection.widthMm === selection.widthMm
      && point.selection.heightMm === selection.heightMm) : [];
  const rows: string[] = [], columns = [...new Set(points.map(point => point.selection.quantity))].sort((a, b) => a - b);
  const cells: Record<string, Record<number, number>> = {}, selections: Record<string, Record<number, RollLabelPricePoint>> = {};
  const blocked = new Set<string>();
  const rowFor = (s: RollLabelSelection) => s.motifCount === 1 ? materialLabel
    : s.motifAllocations.map((quantity, index) => `Motiv ${index + 1}: ${quantity.toLocaleString('da-DK')}`).join(' · ');
  for (const point of points) {
    const row = rowFor(point.selection), quantity = point.selection.quantity, key = JSON.stringify([row, quantity]);
    if (!cells[row]) { rows.push(row); cells[row] = {}; selections[row] = {}; }
    if (blocked.has(key) || selections[row][quantity]) {
      delete cells[row][quantity]; delete selections[row][quantity]; blocked.add(key); continue;
    }
    cells[row][quantity] = point.priceDkk;
    selections[row][quantity] = point;
  }
  const selectedRow = selection ? rowFor(selection) : '';
  const current = selection ? selections[selectedRow]?.[selection.quantity] : null;
  const selectedCell = current && rollLabelPriceSelectionKey(current.selection) === rollLabelPriceSelectionKey(selection!)
    ? { row: selectedRow, column: selection!.quantity } : null;
  return { rows, columns, cells, selections, selectedCell };
}
