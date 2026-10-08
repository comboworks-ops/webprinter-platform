function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,normalized(item)]));
  return value;
}
export function tooltipDraftChanged(draft: unknown, original: unknown) {
  return JSON.stringify(normalized(draft)) !== JSON.stringify(normalized(original));
}
