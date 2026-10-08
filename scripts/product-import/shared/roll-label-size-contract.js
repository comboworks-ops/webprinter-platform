/** Exact source bounds. Never substitute one family's limits for another. */
export function buildRollLabelSizeContract(profile, audit) {
  if (!profile.format.customSize) return null;
  if (!audit || audit.profileKey !== profile.key || audit.articleId !== profile.articleId
    || audit.sourceUnit !== 'cm' || !audit.positiveOrderedLimits
    || (profile.sourceEvidenceSha256 && audit.sourceEvidenceSha256 !== profile.sourceEvidenceSha256)) {
    throw Error(`Missing verified size contract: ${profile.key}`);
  }
  const axes = audit.sourceSizeInputNames.map(name => {
    const axis = name === 'grossdruck_width' ? 'width' : name === 'grossdruck_height' ? 'height' : null;
    if (!axis) throw Error('Unknown source size axis');
    return { axis, sourceInputName: name, minMm: Number(audit.rawLimits[`grossdruck_${axis}_min`]) * 10,
      maxMm: Number(audit.rawLimits[`grossdruck_${axis}_max`]) * 10 };
  });
  if (!axes.some(item => item.axis === 'width') || (profile.format.shape === 'circle' && axes.length !== 1)) {
    throw Error(`Invalid source size axes: ${profile.key}`);
  }
  return { unit: 'mm', sourceUnit: 'cm', axes, heightFromWidth: axes.length === 1,
    sourcePageSha256: audit.sourcePageSha256, sourceOptionsSha256: audit.optionsResponseSha256 };
}
