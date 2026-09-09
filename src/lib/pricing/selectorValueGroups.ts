export interface SelectorValueGroupConfig {
  id: string;
  label: string;
  valueIds: readonly string[];
}

export interface ResolvedSelectorValueGroup<TValue> {
  id: string;
  label: string;
  values: TValue[];
  isFallback: boolean;
}

export const UNASSIGNED_SELECTOR_VALUE_GROUP_ID = "__unassigned__";
export const UNASSIGNED_SELECTOR_VALUE_GROUP_LABEL = "Andre muligheder";

/**
 * Resolves presentation groups against the values that are currently visible.
 *
 * The visible section order is authoritative. A value can only appear in the
 * first configured group that claims it, foreign IDs are ignored, and every
 * unclaimed visible value is kept in a final fallback group.
 */
export function resolveSelectorValueGroups<TValue extends { id: string }>(
  visibleValues: readonly TValue[],
  configuredGroups: readonly SelectorValueGroupConfig[] | null | undefined,
): ResolvedSelectorValueGroup<TValue>[] {
  if (!Array.isArray(configuredGroups) || configuredGroups.length === 0) return [];

  const seenVisibleValueIds = new Set<string>();
  const uniqueVisibleValues = visibleValues.filter((value) => {
    if (seenVisibleValueIds.has(value.id)) return false;
    seenVisibleValueIds.add(value.id);
    return true;
  });
  const claimedValueIds = new Set<string>();
  const resolvedGroups: ResolvedSelectorValueGroup<TValue>[] = [];

  configuredGroups.forEach((group) => {
    const requestedValueIds = new Set(
      Array.isArray(group?.valueIds)
        ? group.valueIds.filter((valueId): valueId is string => typeof valueId === "string")
        : [],
    );

    const values = uniqueVisibleValues.filter((value) => {
      if (!requestedValueIds.has(value.id) || claimedValueIds.has(value.id)) return false;
      claimedValueIds.add(value.id);
      return true;
    });

    if (values.length === 0) return;

    resolvedGroups.push({
      id: String(group.id || `group-${resolvedGroups.length + 1}`),
      label: String(group.label || "Muligheder"),
      values,
      isFallback: false,
    });
  });

  const unassignedValues = uniqueVisibleValues.filter((value) => !claimedValueIds.has(value.id));
  if (unassignedValues.length > 0) {
    resolvedGroups.push({
      id: UNASSIGNED_SELECTOR_VALUE_GROUP_ID,
      label: UNASSIGNED_SELECTOR_VALUE_GROUP_LABEL,
      values: unassignedValues,
      isFallback: true,
    });
  }

  return resolvedGroups;
}
