export type SectionRow<T> = { id: string; title?: string; description?: string; sections: T[] };
/** Move the complete section, retaining its source/value IDs and all settings. */
export function moveSectionToRow<T extends { id: string }>(rows: SectionRow<T>[], sectionId: string, targetRowId: string): SectionRow<T>[] {
  const source = rows.find(row => row.sections.some(section => section.id === sectionId));
  if (!source) throw new Error('Sektionen findes ikke længere.');
  if (source.id === targetRowId) return rows;
  const target = rows.find(row => row.id === targetRowId);
  if (target && target.sections.length >= 3) throw new Error('Der kan højst være tre sektioner på samme række.');
  const section = source.sections.find(item => item.id === sectionId)!;
  const next = rows.map(row => ({ ...row, sections: row.sections.filter(item => item.id !== sectionId) }));
  if (target) next.find(row => row.id === targetRowId)!.sections.push(section);
  else next.splice(rows.indexOf(source) + 1, 0, { id: targetRowId, sections: [section] });
  return next.filter(row => row.sections.length);
}
