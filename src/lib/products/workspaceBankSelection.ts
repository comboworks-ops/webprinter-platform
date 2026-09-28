export type WorkspaceBankItem = {
  id: string; name: string; category: string | null;
  width_mm: number | null; height_mm: number | null;
  icon_name: string | null; bleed_mm: number | null; safe_area_mm: number | null; image_url: string | null;
};
export type WorkspaceBankSelection = {
  id: string; name: string; sourceName: string; libraryTemplateId?: string;
  width_mm?: number | null; height_mm?: number | null; image_url?: string | null;
};

/** Source identity wins over display names. Imported product values can exist
 * without a corresponding library entry and must still be shown first. */
export function workspaceBankChoices(items: WorkspaceBankItem[], selected?: WorkspaceBankSelection) {
  if (!selected) return items.map(item => ({ item, current: false }));
  const match = items.find(item => selected.libraryTemplateId
    ? item.id === selected.libraryTemplateId
    : item.name.trim().toLocaleLowerCase() === selected.sourceName.trim().toLocaleLowerCase()
      && (item.width_mm || null) === (selected.width_mm || null)
      && (item.height_mm || null) === (selected.height_mm || null));
  const current: WorkspaceBankItem = {
    id: `current:${selected.id}`, category: null, icon_name: null, bleed_mm: null, safe_area_mm: null,
    ...match, name: selected.name,
    width_mm: selected.width_mm ?? match?.width_mm ?? null,
    height_mm: selected.height_mm ?? match?.height_mm ?? null,
    image_url: selected.image_url || match?.image_url || null,
  };
  return [{ item: current, current: true }, ...items.filter(item => item !== match).map(item => ({ item, current: false }))];
}
