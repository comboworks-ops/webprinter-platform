function instructionText(rule) {
  const label = {white:'Hvidtryk',hot_foil:'Foliepræg',spot_uv:'UV-spotlak'}[rule.kind];
  if (!label || !['Weiß','praegung','lack'].includes(rule.sourceSpotName) || rule.overprint !== true) throw Error('Unreviewed layer rule');
  const colour = rule.kind === 'white' ? 'cyan' : 'magenta';
  const expected = rule.kind === 'white' ? [100,0,0,0] : [0,100,0,0];
  if (JSON.stringify(rule.alternateCmykPercent) !== JSON.stringify(expected)) throw Error('Unreviewed layer colour');
  const lines = [`${label}: Brug ${rule.vectorRequired ? 'vektorobjekter med ' : ''}en særfarve med navnet ${rule.sourceSpotName}, vist som 100 % ${colour}, og aktivér overprint.`];
  if (rule.solidNoRaster) lines.push('Hvidtryksflader skal være helt dækkende uden raster.');
  if (rule.minimumStroke) {
    if (!(rule.minimumStroke.value > 0) || !['pt','mm'].includes(rule.minimumStroke.unit)) throw Error('Invalid layer stroke');
    lines.push(`Mindste stregtykkelse: ${String(rule.minimumStroke.value).replace('.',',')} ${rule.minimumStroke.unit === 'pt' ? 'punkt' : 'mm'}.`);
  }
  if (rule.minimumCutDistanceMm) lines.push(`Hold de forædlede elementer mindst ${String(rule.minimumCutDistanceMm).replace('.',',')} mm fra stanselinjen.`);
  return lines;
}

/** Exact documentation projection only. Raw source prose never enters the UI;
 * each selectable effect keeps its own source-field/value condition. */
export function buildRollLabelArtworkInstructions(profile, audit) {
  if (!audit) return null;
  if (audit.profileKey !== profile.key || audit.articleId !== profile.articleId
    || audit.sourceMaterialId !== profile.sourceMaterialId || audit.sourceEvidenceSha256 !== profile.sourceEvidenceSha256
    || audit.onlineDesignerVerified !== false || audit.productionLayerNamesApproved?.length !== 0) throw Error('Foreign or promoted artwork evidence');
  if (audit.documentationStatus === 'quote_context_quarantined') return null;
  const kinds = new Set(audit.rules.map(rule=>rule.kind));
  if(kinds.size !== audit.rules.length) throw Error('Ambiguous artwork rule');
  const requirements = audit.requiredMasks.map(mask=> {
    if (!['white','hot_foil','spot_uv'].includes(mask.kind)) throw Error('Unknown mask');
    const condition = mask.condition;
    if(condition.type === 'source_option') {
      const field = profile.optionFields.find(field=>field.sourceFieldId===condition.sourceFieldId);
      if (!field?.values.some(value=>value.sourceValueId===condition.sourceValueId)) throw Error('Foreign mask option');
    } else if (!['material','material_or_article'].includes(condition.type)) throw Error('Unknown mask condition');
    const rule = audit.rules.find(rule=>rule.kind===mask.kind);
    return {kind:mask.kind,condition:{...condition},documented:Boolean(rule),
      instructionsDa:rule ? instructionText(rule) : [`De præcise filkrav til ${{white:'hvidtryk',hot_foil:'foliepræg',spot_uv:'UV-spotlak'}[mask.kind]} mangler for dette valg.`]};
  });
  return {version:1,profileKey:profile.key,sourceEvidenceSha256:profile.sourceEvidenceSha256,
    documentationStatus:audit.documentationStatus,requirements,onlineDesignerVerified:false};
}
