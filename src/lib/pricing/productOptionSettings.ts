type ProductOptionValueSetting = Record<string, unknown>;
type ProductOptionValueSettings = Record<string, ProductOptionValueSetting>;

type ProductOptionSection = Record<string, unknown> & {
  id?: string;
  sectionId?: string;
  valueIds?: string[];
  valueSettings?: ProductOptionValueSettings;
};

type ProductOptionLayoutRow = Record<string, unknown> & {
  columns?: ProductOptionSection[];
};

type ProductOptionPricingStructure = Record<string, unknown> & {
  vertical_axis?: ProductOptionSection;
  layout_rows?: ProductOptionLayoutRow[];
};

export function updateProductOptionValueSetting<
  T extends ProductOptionPricingStructure,
>(
  pricingStructure: T,
  sectionId: string,
  valueId: string,
  update: ProductOptionValueSetting,
): { pricingStructure: T; updated: boolean } {
  let updated = false;

  const updateSection = (section: ProductOptionSection): ProductOptionSection => {
    const isTargetSection = section.sectionId === sectionId || section.id === sectionId;
    if (!isTargetSection || !section.valueIds?.includes(valueId)) {
      return section;
    }

    updated = true;
    return {
      ...section,
      valueSettings: {
        ...(section.valueSettings || {}),
        [valueId]: {
          ...(section.valueSettings?.[valueId] || {}),
          ...update,
        },
      },
    };
  };

  const verticalAxis = pricingStructure.vertical_axis
    ? updateSection(pricingStructure.vertical_axis)
    : pricingStructure.vertical_axis;

  const layoutRows = pricingStructure.layout_rows?.map((row) => {
    const columns = row.columns?.map(updateSection);
    if (!columns || columns.every((column, index) => column === row.columns?.[index])) {
      return row;
    }
    return { ...row, columns };
  });

  if (!updated) {
    return { pricingStructure, updated: false };
  }

  return {
    pricingStructure: {
      ...pricingStructure,
      vertical_axis: verticalAxis,
      layout_rows: layoutRows,
    } as T,
    updated: true,
  };
}
