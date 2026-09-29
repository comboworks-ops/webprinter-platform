/** Resolve the material/format represented by the selected visible price row.
 * The row can change automatically when a finish removes the old combination.
 * This only synchronizes emitted selection IDs; it never calculates a price. */
export function withMatrixRowSelection(
  selections: Record<string, string | null>,
  axis: { sectionId: string; valueIds?: string[] },
  selectedRow: string | null | undefined,
  displayName: (id: string) => string,
): Record<string, string | null> {
  if (!selectedRow) return selections;
  const ids = axis.valueIds || [];
  const matches = ids.includes(selectedRow) ? [selectedRow] : ids.filter(id => displayName(id) === selectedRow);
  const valueId = matches.length === 1 ? matches[0] : null;
  if (selections[axis.sectionId] === valueId) return selections;
  return { ...selections, [axis.sectionId]: valueId };
}
