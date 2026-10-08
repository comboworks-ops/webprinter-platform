import { createNormalizedMatrixRecord } from './normalized-pricing.js';
const KEYS = ['orientation','format','pageCount','paperCover','cover','varnish'];
/** Rehydrate the compact review artifact into the existing publisher's contract.
 * Native IDs stay in sourceIdentifiers; display values coalesce only when their
 * original paper descriptions are identical. No DB client or write is used. */
export function brochureMatrixAdapter(manifest) {
  const groups = new Map(manifest.optionGroups.map(group => [group.key,group]));
  const formats = new Map((groups.get('format')?.values || []).map(value=>[value.key,value]));
  if (KEYS.some(key=>!groups.has(key))) throw new Error('Missing brochure matrix axis');
  const maps = new Map();
  const specs = new Map();
  for (const key of KEYS) {
    const source = groups.get(key), names = new Map(), values = new Map();
    for (const value of source.values) {
      const previous = names.get(value.labelDa.toLowerCase());
      if (previous && previous.original !== value.labelOriginal) throw new Error(`Distinct source choices share a Danish label: ${key}/${value.labelDa}`);
      if (!previous) names.set(value.labelDa.toLowerCase(),{original:value.labelOriginal,spec:{name:value.labelDa,widthMm:value.meta?.widthMm??null,heightMm:value.meta?.heightMm??null,meta:{...value.meta,sourceLabelOriginal:value.labelOriginal,...(key==='format'&&value.key==='free'?{brochureFreeSize:true}:{})}}});
      if (values.has(value.key)) throw new Error('Duplicate native option identity');
      values.set(value.key,value.labelDa);
    }
    maps.set(key,values);specs.set(key,[...names.values()].map(value=>value.spec));
  }
  const definition = (key,order) => ({key,groupName:groups.get(key).labelDa,title:groups.get(key).labelDa,kind:key==='paperCover'?'material':key==='format'?'format':'other',sectionType:key==='paperCover'?'materials':key==='format'?'formats':'other',sortOrder:order,sectionId:`brochure-${key}`,rowId:`brochure-${key}`,uiMode:key==='pageCount'?'dropdown':'buttons',selectionMode:'required',selectionMapKey:key,includeUnconfiguredValues:false,valueSpecs:specs.get(key)});
  const matrixConfig={verticalAxis:{...definition('paperCover',5),extraDataIdField:'materialId'},sections:['orientation','format','pageCount','cover','varnish'].map((key,index)=>({...definition(key,index),isVariantDimension:true,...(key==='format'?{extraDataIdField:'formatId'}:{})}))};
  const remap = selections => {
    if (Object.keys(selections).length!==KEYS.length) throw new Error('Incomplete brochure price selection');
    return Object.fromEntries(KEYS.map(key=>{const name=maps.get(key).get(selections[key]);if(!name)throw new Error(`Unknown brochure source selection ${key}`);return [key,name];}));
  };
  return {matrixConfig,remap,rehydrate(record){
    const format=formats.get(record.selections.format);
    if (!format || format.key==='free') throw new Error('Free size needs an exact-dimension quote');
    return createNormalizedMatrixRecord({...record,selections:remap(record.selections),supplier:manifest.source.supplierSlug,sourceType:'supplier_api',importerKey:manifest.product.sourceKey,productFamily:manifest.product.family,conversionRuleKey:manifest.pricing.conversionRuleKey,sourceIdentifiers:{nativeSelections:record.selections},extraData:{brochureSourceSelections:record.selections,brochurePageCount:Number(record.selections.pageCount),sourceRunId:manifest.runId},dimensions:{widthMm:format.meta.widthMm,heightMm:format.meta.heightMm}});
  }};
}
