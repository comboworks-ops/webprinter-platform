function formatIssues(issues) {
  return issues.map((issue) => `- ${issue}`).join("\n");
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildRecordKey(record, selectionKeys) {
  const selectionPart = selectionKeys
    .map((key) => `${key}:${normalizeText(record?.selections?.[key]) || "<missing>"}`)
    .join("|");
  return `${selectionPart}|qty:${record?.quantity}`;
}

export function validateNormalizedPricingRecords(records, options = {}) {
  const issues = [];
  const warnings = [];
  const rows = Array.isArray(records) ? records : [];

  if (rows.length === 0) {
    issues.push("Import batch is empty");
    return { ok: false, issues, warnings };
  }

  const matrixConfig = options.matrixConfig || null;
  const requiredSelectionKeys = Array.isArray(options.requiredSelectionKeys)
    ? options.requiredSelectionKeys
    : [];

  const allRequiredKeys = new Set(requiredSelectionKeys);
  if (matrixConfig?.verticalAxis?.key) allRequiredKeys.add(matrixConfig.verticalAxis.key);
  for (const section of matrixConfig?.sections || []) {
    if (section?.key) allRequiredKeys.add(section.key);
  }

  const duplicateKeys = new Map();

  rows.forEach((record, index) => {
    if (!record || typeof record !== "object") {
      issues.push(`Row ${index + 1}: record is not an object`);
      return;
    }

    if (!Number.isFinite(record.quantity) || record.quantity <= 0 || Math.round(record.quantity) !== record.quantity) {
      issues.push(`Row ${index + 1}: quantity must be a positive integer`);
    }

    if (
      !Number.isFinite(record.finalPriceDkk) ||
      record.finalPriceDkk <= 0 ||
      Math.round(record.finalPriceDkk) !== record.finalPriceDkk
    ) {
      issues.push(`Row ${index + 1}: finalPriceDkk must be a positive integer`);
    }

    if (!isPlainObject(record.selections)) {
      issues.push(`Row ${index + 1}: selections must be an object`);
      return;
    }

    for (const key of allRequiredKeys) {
      if (!normalizeText(record.selections[key])) {
        issues.push(`Row ${index + 1}: missing required selection '${key}'`);
      }
    }

    const duplicateKey = buildRecordKey(record, Array.from(allRequiredKeys).sort());
    duplicateKeys.set(duplicateKey, (duplicateKeys.get(duplicateKey) || 0) + 1);
  });

  for (const [key, count] of duplicateKeys.entries()) {
    if (count > 1) {
      issues.push(`Duplicate normalized price key detected: ${key}`);
    }
  }

  if (matrixConfig) {
    const sectionIds = new Set();
    const rowIds = new Set();

    if (!normalizeText(matrixConfig.verticalAxis?.sectionId || "vertical-axis")) {
      issues.push("Matrix config is missing a vertical axis sectionId");
    }
    if (!normalizeText(matrixConfig.verticalAxis?.groupName)) {
      issues.push("Matrix config is missing verticalAxis.groupName");
    }
    if (!normalizeText(matrixConfig.verticalAxis?.kind)) {
      issues.push("Matrix config is missing verticalAxis.kind");
    }

    for (const section of matrixConfig.sections || []) {
      const sectionId = normalizeText(section.sectionId);
      const rowId = normalizeText(section.rowId);
      if (!sectionId) {
        issues.push(`Section '${section.key || "<unknown>"}' is missing sectionId`);
      } else if (sectionIds.has(sectionId)) {
        issues.push(`Duplicate matrix sectionId detected: ${sectionId}`);
      } else {
        sectionIds.add(sectionId);
      }

      if (!rowId) {
        issues.push(`Section '${section.key || "<unknown>"}' is missing rowId`);
      } else {
        rowIds.add(rowId);
      }

      if (!normalizeText(section.groupName)) {
        issues.push(`Section '${section.key || "<unknown>"}' is missing groupName`);
      }
      if (!normalizeText(section.kind)) {
        issues.push(`Section '${section.key || "<unknown>"}' is missing kind`);
      }
      if (!normalizeText(section.sectionType)) {
        issues.push(`Section '${section.key || "<unknown>"}' is missing sectionType`);
      }

      if (section.requireDimensions) {
        const specs = Array.isArray(section.valueSpecs) ? section.valueSpecs : [];
        for (const spec of specs) {
          if (!normalizeText(spec?.name)) continue;
          if (!Number.isFinite(Number(spec?.widthMm)) || !Number.isFinite(Number(spec?.heightMm))) {
            issues.push(
              `Section '${section.key || "<unknown>"}' value '${spec.name}' is missing width/height dimensions`
            );
          }
        }
      }
    }

    if (rowIds.size === 0) {
      issues.push("Matrix config does not define any layout rows");
    }
  }

  if (options.maxSpikeFactor && Number.isFinite(options.maxSpikeFactor) && options.maxSpikeFactor > 1) {
    const comparisonKeys = Array.from(allRequiredKeys).sort();
    const buckets = new Map();

    for (const record of rows) {
      const bucketKey = comparisonKeys
        .map((key) => `${key}:${normalizeText(record?.selections?.[key])}`)
        .join("|");
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push(record);
    }

    for (const [bucketKey, bucketRows] of buckets.entries()) {
      const sorted = [...bucketRows].sort((a, b) => a.quantity - b.quantity);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const next = sorted[i];
        if (prev.finalPriceDkk <= 0) continue;
        if (next.finalPriceDkk > prev.finalPriceDkk * options.maxSpikeFactor) {
          warnings.push(
            `Suspicious price spike for ${bucketKey}: ${prev.quantity} -> ${next.quantity} (${prev.finalPriceDkk} -> ${next.finalPriceDkk})`
          );
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

export function assertValidNormalizedPricingRecords(records, options = {}) {
  const result = validateNormalizedPricingRecords(records, options);
  if (!result.ok) {
    throw new Error(`Normalized pricing validation failed:\n${formatIssues(result.issues)}`);
  }
  return result;
}
