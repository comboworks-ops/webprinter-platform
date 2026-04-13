type LinkedTemplateValueSetting = {
  linkedTemplateId?: string | null;
};

type LinkedTemplateSettingsMap = Record<string, LinkedTemplateValueSetting | undefined> | undefined;

type LinkedTemplateSection = {
  id: string;
  sectionType?: string | null;
  valueSettings?: LinkedTemplateSettingsMap;
};

type LinkedTemplateVerticalAxis = {
  id?: string;
  sectionId?: string;
  sectionType?: string | null;
  valueSettings?: LinkedTemplateSettingsMap;
};

type MatrixLikeStructure = {
  vertical_axis?: LinkedTemplateVerticalAxis | null;
  layout_rows?: Array<{
    columns?: LinkedTemplateSection[] | null;
  }> | null;
};

type StorformatLikeStructure = {
  verticalAxis?: LinkedTemplateVerticalAxis | null;
  layoutRows?: Array<{
    sections?: LinkedTemplateSection[] | null;
  }> | null;
};

type SelectedSectionValues = Record<string, string | null | undefined>;

type TemplateCandidate = {
  templateId: string;
  priority: number;
  order: number;
};

const isNonPricingTemplateOverrideSection = (sectionType?: string | null) =>
  sectionType !== "formats" && sectionType !== "materials";

const maybeAddTemplateCandidate = (
  candidates: TemplateCandidate[],
  selectedSectionValues: SelectedSectionValues,
  sectionId: string | undefined,
  sectionType: string | null | undefined,
  valueSettings: LinkedTemplateSettingsMap,
  order: number,
) => {
  if (!sectionId) return;
  const selectedValueId = selectedSectionValues[sectionId];
  if (!selectedValueId) return;
  const linkedTemplateId = valueSettings?.[selectedValueId]?.linkedTemplateId;
  if (!linkedTemplateId) return;

  candidates.push({
    templateId: linkedTemplateId,
    priority: isNonPricingTemplateOverrideSection(sectionType) ? 2 : 1,
    order,
  });
};

const pickWinningTemplate = (candidates: TemplateCandidate[]): string | null => {
  if (candidates.length === 0) return null;

  return candidates
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.order - a.order;
    })[0]?.templateId || null;
};

export function resolveMatrixLinkedTemplateId(
  pricingStructure: MatrixLikeStructure | null | undefined,
  selectedSectionValues: SelectedSectionValues,
): string | null {
  if (!pricingStructure || !selectedSectionValues) return null;

  const candidates: TemplateCandidate[] = [];
  let order = 0;

  const verticalAxis = pricingStructure.vertical_axis;
  if (verticalAxis) {
    maybeAddTemplateCandidate(
      candidates,
      selectedSectionValues,
      verticalAxis.sectionId || verticalAxis.id,
      verticalAxis.sectionType,
      verticalAxis.valueSettings,
      order++,
    );
  }

  (pricingStructure.layout_rows || []).forEach((row) => {
    (row.columns || []).forEach((column) => {
      maybeAddTemplateCandidate(
        candidates,
        selectedSectionValues,
        column.id,
        column.sectionType,
        column.valueSettings,
        order++,
      );
    });
  });

  return pickWinningTemplate(candidates);
}

export function resolveStorformatLinkedTemplateId(
  config: StorformatLikeStructure,
  selectedSectionValues: SelectedSectionValues,
): string | null {
  if (!config || !selectedSectionValues) return null;

  const candidates: TemplateCandidate[] = [];
  let order = 0;

  if (config.verticalAxis) {
    maybeAddTemplateCandidate(
      candidates,
      selectedSectionValues,
      config.verticalAxis.id || config.verticalAxis.sectionId,
      config.verticalAxis.sectionType,
      config.verticalAxis.valueSettings,
      order++,
    );
  }

  (config.layoutRows || []).forEach((row) => {
    (row.sections || []).forEach((section) => {
      maybeAddTemplateCandidate(
        candidates,
        selectedSectionValues,
        section.id,
        section.sectionType,
        section.valueSettings,
        order++,
      );
    });
  });

  return pickWinningTemplate(candidates);
}
