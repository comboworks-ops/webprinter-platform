import type { RollLabelReviewProfile } from './rollLabelReview';

export type RollLabelCodingDelivery = {
  version: 1; profileKey: string; sourceEvidenceSha256: string;
  sourceGuideUrl: string; sourceGuidePdfSha256: string; sourceGuideTextSha256: string;
  instructionsDa: string[]; worksheetLayout: 'single_vertical_column_in_source_depicted_order';
  displayFactsSourceVerified: true; codingDeliveryVerified: false; orderReady: false;
};
export const rollLabelCodingInstructions = [
  'Til nummerering og koder kræves en Excel-liste med én kolonne.',
  'Første række trykkes først og ligger inderst på rullen. Sidste række trykkes sidst og ligger yderst, hvor den ses først.',
  'Vedlæg også en JPG, som viser én nummerering eller kode. Tilføj _ansicht til filnavnet.',
  'Leverandøren behandler og fremstiller kun fortløbende koder og data.',
];
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
// Exact044/046 guide bindings. In particular oval/customer-contour profiles
// have no primitive sizeGeometry whose guide could otherwise anchor this text.
const guides = [
  ['freie_groesse_rechteck', '1f0a6311bb56c7d1e47bc54546ef02b244736ec79cd922d4828bda7e4ad63cc6', '0af0833937321e3a73db43a160f77920f5315c154b098a2283ed67bc186d8298'],
  ['freie_form_1stanzkontur', '5952db1bece595c84ab9107dc88cadf131b6c7f9b6141c1c02136ff8397da3ae', 'caef4f3fd1a58934d3f938f4bc8f711db3e0cd88211b9c21df44a206af8d5df0'],
  ['rund', '7f99bbe5756fa43ee3c7442ea651df54e4e6406165dd85de58299745e20ee5d9', 'abd090b988a3e8b7273ee7e47afc774d59463685568baf6a9bb50ee6e492fd8a'],
  ['freie_groesse_oval', 'fbf4ba45009093cab7e28ccd41b10a5b2aad4c3fa5d90a71395cb2bdbd449095', '78e614f6751b99234ac1b61ea3998f95b15a7eb1c749d8fe13cd126d2d1345f7'],
];
const articles: Record<string, number> = { '61428': 0, '61429': 1, '61430': 2, '61431': 3, '61432': 0, '61433': 1, '61434': 2, '61435': 3 };
/** General source instructions only. No Excel/JPG input, code rendering,
 * selected-font acceptance, roll-count or upload/order bundle is created. */
export function readRollLabelCodingDelivery(profile: RollLabelReviewProfile): RollLabelCodingDelivery | null {
  const c = profile.codingDeliveryDisplay;
  const expected = guides[articles[profile.articleId]];
  if (!c || c.version !== 1 || c.profileKey !== profile.key
    || profile.key !== `${profile.articleId}:${profile.sourceMaterialId}`
    || !profile.customerArtworkRequired || profile.orderReady !== false
    || !profile.optionFields.some(f => f.sourceFieldId === '2059' && f.visible)
    || !hash(c.sourceEvidenceSha256) || c.sourceEvidenceSha256 !== profile.sourceEvidenceSha256
    || c.sourceEvidenceSha256 !== profile.artworkInstructions?.sourceEvidenceSha256
    || !hash(c.sourceGuidePdfSha256) || !hash(c.sourceGuideTextSha256)
    || !/^https:\/\/www\.wir-machen-druck\.de\/tpl\/manns-partner\/media\/ddb\/druckdatenskizzen\/0\/etiketten_nummerierung_codierung_[a-z0-9_]+\.pdf$/.test(c.sourceGuideUrl)
    || c.worksheetLayout !== 'single_vertical_column_in_source_depicted_order'
    || c.displayFactsSourceVerified !== true || c.codingDeliveryVerified !== false || c.orderReady !== false
    || !Array.isArray(c.instructionsDa) || c.instructionsDa.length !== rollLabelCodingInstructions.length
    || c.instructionsDa.some((line, i) => line !== rollLabelCodingInstructions[i])) return null;
  if (!expected || c.sourceGuidePdfSha256 !== expected[1] || c.sourceGuideTextSha256 !== expected[2]
    || c.sourceGuideUrl !== `https://www.wir-machen-druck.de/tpl/manns-partner/media/ddb/druckdatenskizzen/0/etiketten_nummerierung_codierung_${expected[0]}_40_1.pdf`) return null;
  const guide = profile.sizeGeometry?.evidence.find(e => e.role === 'guide');
  if (guide && (guide.sha256 !== c.sourceGuidePdfSha256 || guide.textSha256 !== c.sourceGuideTextSha256)) return null;
  return c;
}
