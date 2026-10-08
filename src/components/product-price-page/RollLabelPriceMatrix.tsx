import { useMemo } from 'react';
import { PriceMatrix } from './PriceMatrix';
import { buildRollLabelPriceMatrix } from '@/lib/products/rollLabelPriceMatrix';
import type { RollLabelPricePreview } from '@/lib/products/rollLabelPricePreview';
import type { RollLabelSelection } from '@/lib/products/rollLabelConfiguration';
import type { RollLabelReviewProfile } from '@/lib/products/rollLabelReview';
import { readRollLabelStockDisplay } from '@/lib/products/rollLabelStockDisplay';

export function RollLabelPriceMatrix({ packet, profile, selection, materialLabel, onChoose }: {
  packet: RollLabelPricePreview | null; profile: RollLabelReviewProfile | null; selection: RollLabelSelection | null;
  materialLabel: string; onChoose: (selection: RollLabelSelection) => void;
}) {
  const matrix = useMemo(() => buildRollLabelPriceMatrix(packet, profile, selection, materialLabel), [packet, profile, selection, materialLabel]);
  const stock = profile && packet ? readRollLabelStockDisplay(profile, packet.productId, packet.familyId) : null;
  return <section className="roll-label-exact-matrix" aria-label="Prismatrix for rulleetiketter">
    <h2>Oplag og priser</h2>
    {matrix.rows.length ? <PriceMatrix rows={matrix.rows} columns={matrix.columns} cells={matrix.cells}
      columnUnit={profile?.customerArtworkRequired === false ? stock?.sourceQuantityUnit === 'rolls' ? 'ruller' : 'kildeantal' : 'stk'}
      rowHeaderLabel={profile && profile.format.motifCount > 1 ? 'Motivfordeling' : 'Materiale'} selectedCell={matrix.selectedCell}
      isCellUnavailable={(row, quantity) => !matrix.selections[row]?.[quantity]}
      onCellClick={(row, quantity) => { const point = matrix.selections[row]?.[quantity]; if (point) onChoose(point.selection); }} />
      : <p role="status">Vælg en dokumenteret kombination af form, materiale, mål og rulleindstillinger for at se priserne.</p>}
    <p className="roll-label-status">Gemte prisforslag for præcis disse valg. Bestilling afventer klargøring.</p>
  </section>;
}
