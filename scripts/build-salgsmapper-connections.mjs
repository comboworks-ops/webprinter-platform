/** Build a read-only, exact-template connection plan from saved live snapshots.
 * Never writes to Supabase or changes pricing. Run with Node 24's TypeScript support.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { APPROVED_PRINT_MODELS, approvedPrintTemplateLaunch } from '../src/lib/mockup/approvedPrintModels.ts';
import { resolveSelectedDesignerTemplateLaunch } from '../src/lib/designer/productTemplateLinks.ts';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
assert(args.snapshots && args.archive && args.output, 'Required: --snapshots=DIR --archive=DIR --output=FILE');
assert(!args['finished-spine'] || ['1mm', '5mm'].includes(args['finished-spine']), 'Finished spine must be explicitly 1mm or 5mm');
const read = name => JSON.parse(fs.readFileSync(path.join(args.snapshots, name), 'utf8'));
const products = read('live-before.json');
const groups = read('attributes-before.json');
const prices = read('price-coverage-before.json');
const bindings = fs.readFileSync(path.join(args.archive, 'review/import-template-binding-map.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const byMatch = new Map(bindings.map(row => [JSON.stringify(row.match), row]));
const models = new Map(APPROVED_PRINT_MODELS.map(model => [model.definition.templateHash, model]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const tenantId = '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba';
const formatKey = name => /DIN lang|M65/i.test(name) ? 'din-lang' : /21\s*[x×]\s*21/.test(name) ? 'square-21x21' : name.match(/A[456]/)?.[0].toLowerCase();
const paperKey = name => /chromo/i.test(name) ? 'chromo-mappekarton' : /silk/i.test(name) ? 'matt-billedtrykskarton' : /natur/i.test(name) ? 'hoejhvid-naturkarton' : /genbrug/i.test(name) ? 'hvid-genbrugskarton' : null;
const finishKey = name => /soft/i.test(name) ? 'soft-touch-lamination' : /mat/i.test(name) ? 'matt-lamination' : /blank/i.test(name) ? 'gloss-lamination' : null;
const result = { version: 1, tenantId, finishedSpine: args['finished-spine'] || null, products: [], pending: [] };
for (const p of products) {
  assert.equal(p.tenant_id, tenantId);
  const standard = p.id === 'acac7c01-2f7c-41d4-86bd-b461ed31b53e';
  if (!standard && !args['finished-spine']) { result.pending.push({ id: p.id, name: p.name, reason: 'Folder construction/spine not specified on existing product' }); continue; }
  const layout = p.pricing_structure;
  const sections = layout.layout_rows.flatMap(row => row.columns);
  const values = new Map(groups.filter(g => g.product_id === p.id).flatMap(g => g.values).map(v => [v.id, v]));
  const spineSection = sections.find(s => s.title === 'Mapperyg');
  const finishSection = sections.find(s => s.id === 'kachering-section');
  const priceCoverage = prices.find(row => row.id === p.id);
  assert(priceCoverage);
  const links = [];
  const evidence = [];
  const renames = [];
  for (const combo of priceCoverage.combinations) {
    const f = values.get(combo.format);
    const paper = values.get(combo.paper);
    const print = combo.variants.map(id => values.get(id)).find(v => /^4\+[04]$/.test(v.name));
    assert(f && paper && print);
    const finishValue = finishSection ? combo.variants.map(id => values.get(id)).find(v => finishSection.valueIds.includes(v.id)) : null;
    const finish = standard ? 'none' : finishValue ? finishKey(finishValue.name) : /spot/i.test(p.name) ? 'partial-uv' : 'high-gloss-uv';
    const spineValues = spineSection ? spineSection.valueIds.map(id => values.get(id)) : [{ id: null, name: args['finished-spine'] }];
    const displayFormat = f.name.replace(/DIN lang/i, 'M65');
    if (displayFormat !== f.name && !renames.some(v => v.id === f.id)) renames.push({ id: f.id, before: f.name, after: displayFormat });
    for (const spineValue of spineValues) {
      const spine = spineValue.name.match(/[15]\s*mm/)?.[0].replace(/\s/g, '');
      const match = { folder_model: `${formatKey(f.name)}--2-part-2-flaps`, print: print.name, spine, paper: paperKey(paper.name), finish };
      const binding = byMatch.get(JSON.stringify(match));
      assert(binding, `No verified binding: ${JSON.stringify(match)}`);
      const t = binding.template;
      const model = models.get(t.sanitizedPdfSha256);
      assert(model, `No approved model: ${binding.documentKey}`);
      const bytes = fs.readFileSync(path.join(args.archive, t.sanitizedPdfPath));
      assert.equal(hash(bytes), t.sanitizedPdfSha256, 'Local PDF hash mismatch');
      assert.equal(model.pages, print.name === '4+0' ? 1 : 2);
      assert(Math.abs(model.definition.sheetWidthMm - t.widthMm) < 0.15);
      assert(Math.abs(model.definition.sheetHeightMm - t.heightMm) < 0.15);
      const selectionConstraints = { 'format-section': f.id, 'print-mode-section': print.id, [layout.vertical_axis.sectionId]: paper.id,
        ...(spineSection ? { [spineSection.id]: spineValue.id } : {}), ...(finishValue ? { [finishSection.id]: finishValue.id } : {}) };
      const link = {
        name: `${displayFormat} · 2 flapper · ${spine.replace('mm', ' mm')} ryg · ${print.name} · ${paper.name}${finishValue ? ` · ${finishValue.name}` : ''}.pdf`,
        url: model.templateUrl, format: displayFormat, configuration: print.name,
        selectionConstraints, templatePdfSha256: t.sanitizedPdfSha256,
        widthMm: t.widthMm, heightMm: t.heightMm, bleedMm: t.bleedMm, safeMm: t.safeMm,
        pageCount: t.pageCount, artworkMode: t.artworkMode, artworkModeReasonDa: t.artworkModeReasonDa,
        designerLoadMode: t.designerLoadMode, lockedInDesigner: true, nonPrintingOverlay: true, excludedFromExport: true,
      };
      links.push(link);
      evidence.push({ documentKey: binding.documentKey, match, hash: t.sanitizedPdfSha256, model: model.kind, pages: model.pages,
        source: binding.template.sourceUrl, localPdf: t.sanitizedPdfPath });
    }
  }
  // Retain historic entries for rollback/reference. Exact bindings take precedence.
  const templates = [...(p.template_files || []), ...links];
  for (const link of links) {
    const selectedOptionLabels = Object.values(link.selectionConstraints).map(id => (renames.find(v => v.id === id)?.after || values.get(id).name));
    const launch = resolveSelectedDesignerTemplateLaunch({ templates, selectedFormatLabel: link.format, selectedOptionLabels, selectedSectionValues: link.selectionConstraints });
    assert.equal(launch?.templatePdfSha256, link.templatePdfSha256, `Ambiguous/missing launch: ${link.name}`);
    const model = models.get(link.templatePdfSha256);
    const adapted = approvedPrintTemplateLaunch(launch, model);
    assert(Math.abs(adapted.widthMm + 2 * adapted.bleedMm - model.definition.sheetWidthMm) < 0.15);
    assert(Math.abs(adapted.heightMm + 2 * adapted.bleedMm - model.definition.sheetHeightMm) < 0.15);
    for (const section of Object.keys(link.selectionConstraints)) {
      assert.equal(resolveSelectedDesignerTemplateLaunch({ templates, selectedSectionValues: { ...link.selectionConstraints, [section]: 'unknown' } }), null);
    }
  }
  result.products.push({ id: p.id, name: p.name, slug: p.slug, beforeTemplates: p.template_files, afterTemplates: templates,
    pricingStructureHash: hash(JSON.stringify(p.pricing_structure)), priceRows: priceCoverage.price_rows, priceHash: priceCoverage.price_hash,
    renames, evidence, summary: { connections: links.length, uniquePdfs: new Set(links.map(t => t.templatePdfSha256)).size,
      onlineDesigner: links.filter(t => t.artworkMode === 'online_designer').length, professionalPdf: links.filter(t => t.artworkMode === 'professional_pdf_upload_only').length } });
}
fs.mkdirSync(path.dirname(args.output), { recursive: true });
fs.writeFileSync(args.output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ products: result.products.map(p => ({ name: p.name, ...p.summary })), pending: result.pending }, null, 2));
