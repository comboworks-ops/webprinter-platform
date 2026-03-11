type JsonObject = Record<string, unknown>;

export interface SiteFrontendConfig {
  buttonKey: string | null;
  buttonOrder: number | null;
  buttonLabel: string | null;
  buttonDescription: string | null;
  buttonImageUrl: string | null;
  activeFinishIds: string[];
  activeProductItemIds: string[];
}

function asObject(value: unknown): JsonObject | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as JsonObject;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return null;
}

function uniqueSiteIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const values = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const values = input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(values));
}

function readButtonMappedSiteIds(siteFrontends: JsonObject): string[] {
  const buttons = asObject(siteFrontends.buttons);
  if (!buttons) return [];

  return Array.from(
    new Set(
      Object.keys(buttons)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function readDirectMappedSiteIds(siteFrontends: JsonObject): string[] {
  const reservedKeys = new Set(["siteIds", "buttons", "button", "updatedAt"]);
  const mappedSiteIds: string[] = [];

  Object.entries(siteFrontends).forEach(([key, rawValue]) => {
    const siteId = key.trim();
    if (!siteId || reservedKeys.has(siteId)) return;

    const value = asObject(rawValue);
    if (!value) return;

    const hasButtonMapping =
      typeof value.button_key === "string" ||
      typeof value.buttonKey === "string" ||
      typeof value.button_order === "number" ||
      typeof value.buttonOrder === "number" ||
      typeof value.button_label === "string" ||
      typeof value.buttonLabel === "string";

    if (hasButtonMapping) {
      mappedSiteIds.push(siteId);
    }
  });

  return Array.from(new Set(mappedSiteIds));
}

function readSiteFrontends(technicalSpecs: unknown): JsonObject | null {
  const specs = asObject(technicalSpecs);
  if (!specs) return null;
  return asObject(specs.site_frontends);
}

function readSiteConfigObject(siteFrontends: JsonObject, siteId: string): JsonObject | null {
  const buttons = asObject(siteFrontends.buttons);
  return asObject(buttons?.[siteId]) || asObject(siteFrontends[siteId]);
}

export function readProductSiteIds(technicalSpecs: unknown): string[] {
  const siteFrontends = readSiteFrontends(technicalSpecs);
  if (!siteFrontends) return [];

  const explicitSiteIds = uniqueSiteIds(siteFrontends.siteIds);
  const buttonMappedSiteIds = readButtonMappedSiteIds(siteFrontends);
  const directMappedSiteIds = readDirectMappedSiteIds(siteFrontends);

  return Array.from(
    new Set([...explicitSiteIds, ...buttonMappedSiteIds, ...directMappedSiteIds])
  );
}

export function readSiteFrontendConfig(
  technicalSpecs: unknown,
  siteId: string,
): SiteFrontendConfig {
  const siteFrontends = readSiteFrontends(technicalSpecs) || {};
  const bySite = readSiteConfigObject(siteFrontends, siteId) || {};
  const pricing = asObject(bySite.pricing) || asObject(siteFrontends.pricing) || {};

  return {
    buttonKey: asString(bySite.button_key ?? bySite.buttonKey),
    buttonOrder: asNumber(bySite.button_order ?? bySite.buttonOrder),
    buttonLabel: asString(bySite.button_label ?? bySite.buttonLabel),
    buttonDescription: asString(bySite.button_description ?? bySite.buttonDescription),
    buttonImageUrl: asString(bySite.button_image_url ?? bySite.buttonImageUrl),
    activeFinishIds: asStringArray(pricing.active_finish_ids ?? pricing.activeFinishIds),
    activeProductItemIds: asStringArray(
      pricing.active_product_item_ids ?? pricing.activeProductItemIds,
    ),
  };
}

export function writeProductSiteIds(
  technicalSpecs: unknown,
  siteIds: string[],
): JsonObject {
  const specs = asObject(technicalSpecs) || {};
  const siteFrontends = asObject(specs.site_frontends) || {};

  return {
    ...specs,
    site_frontends: {
      ...siteFrontends,
      siteIds: uniqueSiteIds(siteIds),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function writeSiteFrontendConfig(
  technicalSpecs: unknown,
  siteId: string,
  config: SiteFrontendConfig,
): JsonObject {
  const normalizedSiteId = siteId.trim();
  if (!normalizedSiteId) {
    const specs = asObject(technicalSpecs);
    return specs || {};
  }

  const specs = asObject(technicalSpecs) || {};
  const siteFrontends = asObject(specs.site_frontends) || {};
  const buttons = asObject(siteFrontends.buttons) || {};
  const existingSiteConfig = readSiteConfigObject(siteFrontends, normalizedSiteId) || {};

  const nextSiteConfig: JsonObject = { ...existingSiteConfig };
  delete nextSiteConfig.button_key;
  delete nextSiteConfig.buttonKey;
  delete nextSiteConfig.button_order;
  delete nextSiteConfig.buttonOrder;
  delete nextSiteConfig.button_label;
  delete nextSiteConfig.buttonLabel;
  delete nextSiteConfig.button_description;
  delete nextSiteConfig.buttonDescription;
  delete nextSiteConfig.button_image_url;
  delete nextSiteConfig.buttonImageUrl;
  delete nextSiteConfig.pricing;

  const nextButtonKey = asString(config.buttonKey);
  const nextButtonOrder = asNumber(config.buttonOrder);
  const nextButtonLabel = asString(config.buttonLabel);
  const nextButtonDescription = asString(config.buttonDescription);
  const nextButtonImageUrl = asString(config.buttonImageUrl);
  const activeFinishIds = asStringArray(config.activeFinishIds);
  const activeProductItemIds = asStringArray(config.activeProductItemIds);

  if (nextButtonKey) nextSiteConfig.button_key = nextButtonKey;
  if (nextButtonOrder !== null) nextSiteConfig.button_order = nextButtonOrder;
  if (nextButtonLabel) nextSiteConfig.button_label = nextButtonLabel;
  if (nextButtonDescription) nextSiteConfig.button_description = nextButtonDescription;
  if (nextButtonImageUrl) nextSiteConfig.button_image_url = nextButtonImageUrl;

  if (activeFinishIds.length > 0 || activeProductItemIds.length > 0) {
    nextSiteConfig.pricing = {
      ...(activeFinishIds.length > 0 ? { active_finish_ids: activeFinishIds } : {}),
      ...(activeProductItemIds.length > 0
        ? { active_product_item_ids: activeProductItemIds }
        : {}),
    };
  }

  const nextButtons: JsonObject = { ...buttons };
  if (Object.keys(nextSiteConfig).length > 0) {
    nextButtons[normalizedSiteId] = nextSiteConfig;
  } else {
    delete nextButtons[normalizedSiteId];
  }

  const nextSiteFrontends: JsonObject = {
    ...siteFrontends,
    updatedAt: new Date().toISOString(),
  };

  if (Object.keys(nextButtons).length > 0) {
    nextSiteFrontends.buttons = nextButtons;
  } else {
    delete nextSiteFrontends.buttons;
  }

  return {
    ...specs,
    site_frontends: nextSiteFrontends,
  };
}

export function removeProductSiteAssignment(
  technicalSpecs: unknown,
  siteId: string,
): JsonObject {
  const normalizedSiteId = siteId.trim();
  if (!normalizedSiteId) {
    const specs = asObject(technicalSpecs);
    return specs || {};
  }

  const specs = asObject(technicalSpecs) || {};
  const siteFrontends = asObject(specs.site_frontends) || {};
  const buttons = asObject(siteFrontends.buttons) || {};
  const nextSiteIds = uniqueSiteIds(siteFrontends.siteIds).filter(
    (value) => value !== normalizedSiteId,
  );

  const nextSiteFrontends: JsonObject = {
    ...siteFrontends,
    siteIds: nextSiteIds,
    updatedAt: new Date().toISOString(),
  };

  delete nextSiteFrontends[normalizedSiteId];

  if (Object.prototype.hasOwnProperty.call(buttons, normalizedSiteId)) {
    const { [normalizedSiteId]: _removedButton, ...remainingButtons } = buttons;
    if (Object.keys(remainingButtons).length > 0) {
      nextSiteFrontends.buttons = remainingButtons;
    } else {
      delete nextSiteFrontends.buttons;
    }
  }

  return {
    ...specs,
    site_frontends: nextSiteFrontends,
  };
}

export function isSiteExclusiveProduct(technicalSpecs: unknown): boolean {
  const siteFrontends = readSiteFrontends(technicalSpecs);
  if (!siteFrontends) return false;

  return (
    siteFrontends.site_only === true ||
    siteFrontends.siteOnly === true ||
    siteFrontends.catalog_scope === "site_only" ||
    siteFrontends.catalogScope === "site_only" ||
    siteFrontends.visibility === "site_only"
  );
}

export function isSiteManagedProduct(technicalSpecs: unknown): boolean {
  if (isSiteExclusiveProduct(technicalSpecs)) return true;
  return readProductSiteIds(technicalSpecs).length > 0;
}

export function writeSiteExclusiveProduct(
  technicalSpecs: unknown,
  isExclusive: boolean,
): JsonObject {
  const specs = asObject(technicalSpecs) || {};
  const siteFrontends = asObject(specs.site_frontends) || {};

  return {
    ...specs,
    site_frontends: {
      ...siteFrontends,
      site_only: isExclusive,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function isProductAssignedToSite(
  technicalSpecs: unknown,
  siteId: string,
): boolean {
  return readProductSiteIds(technicalSpecs).includes(siteId);
}
