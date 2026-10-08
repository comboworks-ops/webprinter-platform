import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const templateReviewPath = (profile, sha256) => `/roll-label-template-review/${profile.articleId}/${profile.sourceMaterialId}/${sha256}.pdf`;
const hash = value => createHash('sha256').update(value).digest('hex');
const positive = value => Number.isFinite(value) && value > 0;

/** Exact local candidate binding, never a hosted template or export approval. */
export function buildRollLabelTemplateContract(profile, document, guide, evidence) {
  if (document.profileKey !== profile.key || document.articleId !== profile.articleId
    || document.materialId !== profile.sourceMaterialId || document.sourceEvidenceSha256 !== profile.sourceEvidenceSha256
    || document.formatValueId !== profile.formatValueId || document.materialValueId !== profile.materialValueId) throw Error('Foreign or stale template document');
  const result = { version: 1, profileKey: profile.key, articleId: profile.articleId, materialId: profile.sourceMaterialId,
    formatValueId: profile.formatValueId, materialValueId: profile.materialValueId, sourceEvidenceSha256: profile.sourceEvidenceSha256,
    localReviewOnly: true, designerReady: false, orderReady: false, hostedBindingVerified: false, template: null };
  if (profile.blockers.length) return { ...result, status: 'profile_quarantined' };
  if (!profile.customerArtworkRequired) return { ...result, status: 'customer_artwork_not_required' };
  if (!document.candidate || !guide) return { ...result, status: 'exact_sanitized_template_pending' };
  if (document.missingMaskKinds?.length) return { ...result, status: 'exact_mask_instructions_pending' };
  const candidate = document.candidate;
  if (!evidence || evidence.sha256 !== candidate.sha256 || !/^[a-f0-9]{64}$/.test(candidate.sha256)
    || evidence.structuralChecks !== 'passed' || guide.vectorGuide?.templateSha256 !== candidate.sha256
    || guide.vectorGuide?.articleId !== profile.articleId || evidence.pages.length !== candidate.pageCount
    || evidence.pages.length !== guide.vectorGuide.pages.length) throw Error('Unverified template bytes or geometry');
  const sources = profile.documents.filter(d => d.role === 'template' && d.url === candidate.sourceUrl);
  if (sources.length !== 1) throw Error('Ambiguous source template');
  const pages = evidence.pages.map((page, index) => {
    const geometry = guide.vectorGuide.pages[index];
    if (![page.widthPt, page.heightPt].every(positive)
      || Math.abs(page.widthPt - geometry.widthPt) > 0.03 || Math.abs(page.heightPt - geometry.heightPt) > 0.03) throw Error('Template page dimensions differ');
    return { page: index + 1, mediaWidthMm: page.widthPt * 25.4 / 72, mediaHeightMm: page.heightPt * 25.4 / 72,
      // Source TrimBox can cover the whole page: retain it, never infer a die from it.
      pageBoxes: page.pageBoxes, label: geometry.label };
  });
  return { ...result, status: 'exact_local_download_review', template: { name: `etiket-${profile.articleId}-${profile.sourceMaterialId}.pdf`,
    url: templateReviewPath(profile, candidate.sha256), templatePdfSha256: candidate.sha256, pages,
    bleedMm: candidate.bleedMm, safeMm: candidate.safeMm, geometryRole: pages.length > 1 ? 'booklet_spreads' : 'label',
    designerTemplateId: null, expectedDesignerPdfSha256: candidate.sha256, designerExportVerified: false } };
}

/** Only sanitized candidate directories are eligible, and symlinks cannot escape them. */
export async function readVerifiedRollLabelTemplate(root, entry, expectedSha256) {
  if (entry.status !== 'exact_local_download_review' || entry.contract.template?.templatePdfSha256 !== expectedSha256
    || entry.contract.localReviewOnly !== true || entry.contract.designerReady !== false) throw Error('Template review blocked');
  if (!/^(designer-preparation\/templates\/standard-[0-9]+|acceptance\/booklet\/templates\/booklet-[0-9]+)\.pdf$/.test(entry.localPath)) throw Error('Unreviewed template path');
  const source = path.join(root, 'docs/roll-labels-2026-09-30');
  const filename = await fs.realpath(path.join(source, entry.localPath));
  const directory = await fs.realpath(path.join(source, path.dirname(entry.localPath)));
  if (path.dirname(filename) !== directory || filename !== path.join(directory, path.basename(entry.localPath))) throw Error('Template path escaped');
  const bytes = await fs.readFile(filename);
  if (hash(bytes) !== expectedSha256 || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw Error('Template bytes changed');
  return bytes;
}
