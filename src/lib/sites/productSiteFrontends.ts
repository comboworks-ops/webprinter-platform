type JsonObject = Record<string, unknown>;

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
