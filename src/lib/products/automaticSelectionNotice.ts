export type SelectionSnapshot = Record<string, { value: string; label: string; title: string }>;

/** Presentation only: compare committed choices without resolving or changing them. */
export function automaticSelectionChanges(before: SelectionSnapshot, after: SelectionSnapshot, manualKeys: string[]) {
  return Object.entries(after).flatMap(([key, next]) => {
    const previous = before[key];
    if (!previous || previous.value === next.value || manualKeys.includes(key)) return [];
    return [`${next.title}: ${previous.label} → ${next.label}`];
  });
}
