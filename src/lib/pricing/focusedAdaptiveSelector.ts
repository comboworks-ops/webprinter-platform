export type FocusedAdaptiveSectionCandidate = {
  id: string;
  adaptive: boolean;
  availablePresentationKinds: Array<string | null | undefined>;
};

export function findEmbeddedAdaptiveSelectorSectionId({
  focusSectionId,
  sections,
}: {
  focusSectionId: string | null;
  sections: FocusedAdaptiveSectionCandidate[];
}): string | null {
  if (!focusSectionId) return null;

  const focusIndex = sections.findIndex((section) => section.id === focusSectionId);
  if (focusIndex < 0) return null;

  const match = sections.slice(focusIndex + 1).find((section) => {
    const presentationKinds = section.availablePresentationKinds.filter(Boolean);

    return section.adaptive
      && presentationKinds.length === section.availablePresentationKinds.length
      && presentationKinds.length > 0
      && new Set(presentationKinds).size === 1
      && (presentationKinds[0] === "format" || presentationKinds[0] === "filling");
  });

  return match?.id || null;
}
