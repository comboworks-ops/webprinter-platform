const PT_PER_MM = 72 / 25.4;

/** Preserve recorded vector coordinates. No geometry is interpolated or taken
 * from another article. The runtime receives paths, never supplier SVG/HTML. */
export function rollLabelSvgPath(items) {
  let d = '', end = null;
  const point = p => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) throw Error('Invalid guide point');
    return p.join(' ');
  };
  const move = p => { if (!end || p[0] !== end[0] || p[1] !== end[1]) d += `M ${point(p)} `; };
  for (const item of items) {
    if (item[0] === 'l') { move(item[1]); d += `L ${point(item[2])} `; end = item[2]; }
    else if (item[0] === 'c') { move(item[1]); d += `C ${point(item[2])} ${point(item[3])} ${point(item[4])} `; end = item[4]; }
    else if (item[0] === 're') {
      const r = item[1]; if (r.length !== 4 || !r.every(Number.isFinite)) throw Error('Invalid guide rectangle');
      d += `M ${r[0]} ${r[1]} L ${r[2]} ${r[1]} L ${r[2]} ${r[3]} L ${r[0]} ${r[3]} Z `; end = null;
    } else if (item[0] === 'qu') {
      const q = item[1]; if (q.length !== 4) throw Error('Invalid guide quadrilateral');
      // PyMuPDF Quad order is upper-left, upper-right, lower-left, lower-right.
      d += `M ${point(q[0])} L ${point(q[1])} L ${point(q[3])} L ${point(q[2])} Z `; end = null;
    } else throw Error('Unreviewed guide path operator');
  }
  if (!d) throw Error('Empty guide geometry');
  return d.trim();
}

export function buildRollLabelNativeGuide(profile, candidate, guide) {
  if (!candidate || !guide || profile.blockers.length || !profile.customerArtworkRequired) return null;
  if (String(candidate.article_id) !== profile.articleId || String(guide.articleId) !== profile.articleId) throw Error('Foreign roll guide');
  if (candidate.semantic_blockers?.length || guide.semanticBlockers?.length || guide.sourceGeometryBlockers?.length) return null;
  const source = candidate.source_pdf || candidate.source;
  if (profile.documents.filter(d => d.role === 'template' && d.url === source.url).length !== 1) throw Error('Roll guide template source mismatch');
  const booklet = Boolean(candidate.pages);
  const widthMm = booklet ? candidate.spread_data_mm[0] : candidate.width_mm + candidate.bleed_mm * 2;
  const heightMm = booklet ? candidate.spread_data_mm[1] : candidate.height_mm + candidate.bleed_mm * 2;
  if (!booklet && (profile.format.customSize || profile.format.dimensions?.widthMm !== candidate.width_mm
    || profile.format.dimensions?.heightMm !== candidate.height_mm)) throw Error('Roll guide dimensions mismatch');
  const pages = booklet ? candidate.pages.map(page => ({
    widthPt: widthMm * PT_PER_MM, heightPt: heightMm * PT_PER_MM,
    label: `Opslag ${page.pdf_page} · sidefølge ${page.side_order_left_to_right.join(' → ')}`,
    paths: [{role:'data',d:rollLabelSvgPath([['re',[0,0,widthMm*PT_PER_MM,heightMm*PT_PER_MM]]])},
      ...page.retained_paths.map(p => ({role:p.role,d:rollLabelSvgPath(p.items)}))],
    labels: page.source_side_labels.map(label => ({ text:`${label.side}`,
      x:(label.source_bbox_pt[0]+label.source_bbox_pt[2])/2,
      y:(label.source_bbox_pt[1]+label.source_bbox_pt[3])/2 })),
  })) : [{widthPt:widthMm*PT_PER_MM,heightPt:heightMm*PT_PER_MM,label:guide.formatLabel,
    paths:Object.entries(candidate.source_paths).map(([role,items]) => ({role,d:rollLabelSvgPath(items)})),labels:[]}];
  return {productName:guide.productName,formatLabel:booklet ? `${candidate.booklet_sides} sider · to opslag` : guide.formatLabel,
    finishedWidthMm:booklet ? candidate.spread_trim_mm[0] : candidate.width_mm,
    finishedHeightMm:booklet ? candidate.spread_trim_mm[1] : candidate.height_mm,
    finishedFormatLabel:booklet ? 'Opslag efter beskæring' : 'Færdigt format',
    dataWidthMm:widthMm,dataHeightMm:heightMm,bleedMm:candidate.bleed_mm,
    safeAreaMm:candidate.safe_mm ?? candidate.safe_mm_nominal,minDpi:300,layoutKind:'flat',
    instructionsDa:guide.instructionsDa,vectorGuide:{version:1,articleId:profile.articleId,
      templateSha256:candidate.sha256,pages},template:null};
}
