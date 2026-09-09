export type ExactCombinationSelection = Record<string, string | null | undefined>;

export type ExactCombinationCandidate = {
  selections: ExactCombinationSelection;
};

export type ResolveClosestExactCombinationArgs = {
  candidates: ExactCombinationCandidate[];
  currentSelections: ExactCombinationSelection;
  requestedSectionId: string;
  requestedValueId: string;
  sectionOrder: string[];
  lockedSectionIds?: string[];
};

/**
 * Resolve a requested value to the closest documented, exact combination.
 *
 * Candidates must come from real price rows. The resolver never fills gaps or
 * combines values from different candidates. It minimizes the number of
 * changed selections first, then prefers preserving earlier sections in the
 * supplied customer-facing order.
 */
export function resolveClosestExactCombination({
  candidates,
  currentSelections,
  requestedSectionId,
  requestedValueId,
  sectionOrder,
  lockedSectionIds = [],
}: ResolveClosestExactCombinationArgs): ExactCombinationCandidate | null {
  if (!requestedSectionId || !requestedValueId || !sectionOrder.includes(requestedSectionId)) {
    return null;
  }

  const locked = new Set(lockedSectionIds);
  let best: ExactCombinationCandidate | null = null;
  let bestChangedCount = Number.POSITIVE_INFINITY;
  let bestPreservation: number[] | null = null;

  for (const candidate of candidates) {
    if (candidate.selections[requestedSectionId] !== requestedValueId) continue;

    const violatesLock = Array.from(locked).some((sectionId) => {
      const currentValue = currentSelections[sectionId];
      return currentValue != null && candidate.selections[sectionId] !== currentValue;
    });
    if (violatesLock) continue;

    let changedCount = 0;
    const preservation: number[] = [];

    for (const sectionId of sectionOrder) {
      if (sectionId === requestedSectionId) continue;

      const currentValue = currentSelections[sectionId];
      if (currentValue == null) continue;

      const preserved = candidate.selections[sectionId] === currentValue;
      preservation.push(preserved ? 1 : 0);
      if (!preserved) changedCount += 1;
    }

    let preferred = best == null || changedCount < bestChangedCount;
    if (!preferred && changedCount === bestChangedCount && bestPreservation) {
      for (let index = 0; index < preservation.length; index += 1) {
        if (preservation[index] === bestPreservation[index]) continue;
        preferred = preservation[index] > bestPreservation[index];
        break;
      }
    }

    if (!preferred) continue;

    best = candidate;
    bestChangedCount = changedCount;
    bestPreservation = preservation;
  }

  return best;
}
