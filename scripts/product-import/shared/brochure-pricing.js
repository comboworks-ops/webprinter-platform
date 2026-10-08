/** Only the requested classic stitching, cover paper and dispersion finish.
 * Other finishing fields stay at the supplier's explicit zero-cost default. */
function coverPaperType(label) {
  if (/recycling/i.test(label)) return 'recycled';
  if (/offset|naturpapier/i.test(label)) return 'natural';
  if (/glänzend/i.test(label)) return 'gloss';
  if (/matt/i.test(label)) return 'matte';
  throw new Error(`Unreviewed cover paper: ${label}`);
}
export function brochureVariants(fields) {
  let variants = [{ selections: {}, upsells: {}, percentage: 0, cover: 'default', varnish: 'none' }];
  for (const field of fields) {
    let values;
    const cover = /umschlag papier/i.test(field.labelOriginal);
    const simpleFinish = field.labelOriginal === 'Einfache Veredelung';
    const varnish = /dispersionslack/i.test(field.labelOriginal) || (simpleFinish && field.values.some(v => v.labelOriginal === 'Umschlag einseitig vollflächiger Dispersionslack matt'));
    if (simpleFinish && varnish) values = field.values.filter(v => ['Umschlag ohne Veredelung', 'Umschlag einseitig vollflächiger Dispersionslack matt'].includes(v.labelOriginal));
    else if (cover || varnish) values = field.values;
    else if (/heftung/i.test(field.labelOriginal)) values = field.values.filter(v => /klassische drahtheftung/i.test(v.labelOriginal));
    else {
      const free = field.values.filter(v => v.percentage === 0 && v.salePrice === 0 && v.basePrice === 0 && v.minimumPrice === 0);
      values = free.filter(v => v.preselected);
      // Some native finishing menus omit a preselection flag. Only the explicit
      // no-finishing choice is equivalent to the requested uncoated default.
      if (!values.length && field.labelOriginal === 'Einfache Veredelung') values = free.filter(v => v.labelOriginal === 'Umschlag ohne Veredelung');
      if (values.length !== 1) throw new Error(`No reviewed default for ${field.labelOriginal}`);
    }
    if (!values?.length) throw new Error(`No reviewed default for ${field.labelOriginal}`);
    for (const v of values) {
      const supportedPercentage = field.priceType === 2 || (simpleFinish && field.priceType === 5 && v.labelOriginal === 'Umschlag einseitig vollflächiger Dispersionslack matt');
      if (v.salePrice !== 0 || v.basePrice !== 0 || v.minimumPrice !== 0 || !Number.isInteger(v.percentage) || v.percentage < 0 || (v.percentage > 0 && !supportedPercentage)) throw new Error('Unsupported supplier fee rule');
    }
    variants = variants.flatMap(current => values.map(v => ({
      // The native type-5 combined menu reports a percentage in its inventory
      // but get-price charges zero for this dispersion choice. Every format's
      // exact quote samples must confirm this policy before any row is enabled.
      ...current, percentage: current.percentage + (simpleFinish && field.priceType === 5 ? 0 : v.percentage),
      upsells: { ...current.upsells, [field.id]: { id: v.id, value: v.labelOriginal } },
      selections: { ...current.selections, [`field_${field.id}`]: String(v.id) },
      cover: cover ? coverPaperType(v.labelOriginal) : current.cover,
      varnish: varnish && v.percentage > 0 ? 'dispersion_matte' : current.varnish,
    })));
  }
  return variants;
}
/** Integer cents preserve the API's rounded two-decimal net price. This is
 * enabled only after exact quote samples verify the explicit supplier rule. */
export function brochureSupplierNet(baseEur, percentage) {
  if (!Number.isFinite(baseEur) || baseEur <= 0 || !Number.isInteger(percentage) || percentage < 0) throw new Error('Invalid supplier price rule');
  const cents = BigInt(Math.round(baseEur * 100));
  return Number((cents * BigInt(100 + percentage) + 50n) / 100n) / 100;
}

/** IDs/order and paper grammage remain in the exact field inventory. Monetary
 * equivalence uses only supported choices and their explicit percentage fees.
 * Unknown fixed/minimum fees are rejected by brochureVariants before grouping. */
export function brochurePricePolicy(fields) {
  const policy = brochureVariants(fields).map(({ cover, varnish, percentage }) => ({ cover, varnish, percentage }))
    .sort((left, right) => `${left.cover}/${left.varnish}`.localeCompare(`${right.cover}/${right.varnish}`));
  if (new Set(policy.map(value => `${value.cover}/${value.varnish}`)).size !== policy.length) throw new Error('Ambiguous cover/varnish price identity');
  return policy;
}
