/** Read-only plan builder for the approved Salgsmapper 1 mm + 5 mm choices.
 * Generates guarded data SQL and a reversible rollback; never connects to a DB.
 * Run with Node 24, from the repository scripts directory.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { APPROVED_PRINT_MODELS, approvedPrintTemplateLaunch } from '../src/lib/mockup/approvedPrintModels.ts';
import { resolveSelectedDesignerTemplateLaunch, isOnlineDesignerAvailableForLaunch } from '../src/lib/designer/productTemplateLinks.ts';

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
assert(args.before && args.candidates && args.output, 'Required: --before=FILE --candidates=DIR --output=DIR');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const before = read(args.before);
const candidates = ['1mm', '5mm'].map(spine => read(path.join(args.candidates, `candidate-${spine}.json`)));
const tenantId = '7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba';
const ids = ['62b759c7-7083-45bb-bd11-e0fb3fd493eb', '8e89d418-74f3-4bfb-9f17-13da2ed74946', '27bbf599-2e21-43cc-9808-995b90c6a205'];
const models = new Map(APPROVED_PRINT_MODELS.map(model => [model.definition.templateHash, model]));
const uuid = input => {
  const h = createHash('sha256').update(`salgsmapper-finished-spine-v1:${input}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
};
const plan = { version: 1, tenantId, approvedSpines: ['1mm', '5mm'], products: [], checks: { exact: 0, failClosed: 0 } };
for (const id of ids) {
  const p = before.products.find(p => p.id === id);
  assert(p && p.tenant_id === tenantId);
  const existingGroups = before.attributes.filter(g => g.product_id === id);
  const pricing = structuredClone(p.pricing_structure);
  assert.equal(pricing.mode, 'matrix_layout_v1');
  assert(!pricing.layout_rows.some(row => row.columns.some(col => col.title === 'Mapperyg')), 'Spine already exists; review current data instead of duplicating it');
  const groupId = uuid(`${id}:group`);
  const valueIds = ['1mm', '5mm'].map(spine => uuid(`${id}:${spine}`));
  assert(!existingGroups.some(g => g.id === groupId));
  const sectionId = 'folder-spine-section';
  const group = { id: groupId, tenant_id: tenantId, product_id: id, name: 'Mapperyg', kind: 'finish', ui_mode: 'buttons', source: 'product', sort_order: Math.max(...existingGroups.map(g => g.sort_order || 0)) + 1, enabled: true };
  const values = valueIds.map((id, index) => ({ id, tenant_id: tenantId, product_id: p.id, group_id: groupId, name: `${index ? 5 : 1} mm ryg`, key: `${index ? 5 : 1}-mm-ryg`, sort_order: index, enabled: true }));
  const spineSection = { id: sectionId, title: 'Mapperyg', groupId, sectionType: 'finishes', ui_mode: 'buttons', valueIds, description: 'Tykkelsen på mappen', selection_mode: 'free', thumbnail_size: 'small', selectorStyling: {}, valueSettings: {} };
  const formatRow = pricing.layout_rows.find(row => row.columns.some(col => col.sectionType === 'formats'));
  assert(formatRow);
  formatRow.columns.push(spineSection);
  const links = [];
  const evidence = [];
  const renames = [];
  for (const [index, candidate] of candidates.entries()) {
    const source = candidate.products.find(x => x.id === id);
    assert(source && source.priceHash === p.price_hash && source.priceRows === p.price_count, 'Price coverage changed since candidate verification');
    for (const link of source.afterTemplates) {
      assert(link.templatePdfSha256 && link.selectionConstraints && link.format);
      links.push({ ...link, selectionConstraints: { ...link.selectionConstraints, [sectionId]: valueIds[index] } });
    }
    evidence.push(...source.evidence);
    for (const rename of source.renames) {
      const current = existingGroups.flatMap(g => g.values).find(v => v.id === rename.id);
      assert(current && current.name === rename.before);
      if (!renames.some(r => r.id === rename.id)) renames.push(rename);
    }
  }
  const afterTemplates = [...(p.template_files || []), ...links];
  const allValues = new Map([...existingGroups.flatMap(g => g.values), ...values].map(v => [v.id, v]));
  for (const rename of renames) allValues.set(rename.id, { ...allValues.get(rename.id), name: rename.after });
  for (const link of links) {
    const model = models.get(link.templatePdfSha256);
    assert(model, `Unapproved model: ${link.name}`);
    assert.equal(model.templateUrl, link.url);
    assert(Math.abs(model.definition.sheetWidthMm - link.widthMm) < .15 && Math.abs(model.definition.sheetHeightMm - link.heightMm) < .15);
    assert.equal(model.pages, link.configuration === '4+0' ? 1 : 2);
    const selected = link.selectionConstraints;
    const resolve = selectedSectionValues => resolveSelectedDesignerTemplateLaunch({ templates: afterTemplates, selectedFormatLabel: link.format, selectedOptionLabels: Object.values(selectedSectionValues).map(id => allValues.get(id)?.name || 'unknown'), selectedSectionValues });
    const launch = resolve(selected);
    assert.equal(launch?.templatePdfSha256, link.templatePdfSha256, `Wrong template: ${link.name}`);
    const adapted = approvedPrintTemplateLaunch(launch, model);
    assert.equal(adapted.widthMm + 2 * link.bleedMm, model.definition.sheetWidthMm);
    assert.equal(adapted.heightMm + 2 * link.bleedMm, model.definition.sheetHeightMm);
    const spotUv = p.slug === 'salgsmapper-med-uv-spotlak';
    assert.equal(isOnlineDesignerAvailableForLaunch(launch), !spotUv, 'Spot UV requires a separately prepared mask');
    plan.checks.exact++;
    for (const key of Object.keys(selected)) {
      assert.equal(resolve({ ...selected, [key]: 'unknown-value' }), null, `Unsafe fallback: ${link.name} / ${key}`);
      plan.checks.failClosed++;
    }
    assert.equal(resolve({ ...selected, [sectionId]: undefined }), null, 'Missing spine must not select a template');
    plan.checks.failClosed++;
  }
  const priceRows = before.prices.filter(row => row.product_id === id);
  const combos = new Set(priceRows.map(row => JSON.stringify([row.extra_data.formatId, row.extra_data.materialId, [...(row.extra_data.variantValueIds || [])].sort()])));
  assert.equal(links.length, combos.size * 2, 'Every priced configuration must have both spines');
  for (const row of priceRows) assert(!(row.extra_data.variantValueIds || []).some(v => valueIds.includes(v)), 'Spine cannot alter the price variant key');
  const beforeProduct = { ...p }; delete beforeProduct.price_count; delete beforeProduct.price_hash;
  plan.products.push({ id, slug: p.slug, name: p.name, beforeProduct, beforeGroups: existingGroups, afterPricingStructure: pricing, afterTemplates, group, values, renames, evidence, priceHash: p.price_hash, priceRows: p.price_count, summary: { connections: links.length, uniquePdfs: new Set(links.map(l => l.templatePdfSha256)).size, onlineDesigner: links.filter(l => l.artworkMode === 'online_designer').length } });
}

const literal = JSON.stringify(plan);
assert(!literal.includes('$folder_plan$'));
const payload = `plan jsonb := $folder_plan$${literal}$folder_plan$::jsonb;`;
const fingerprint = `select md5(string_agg(g.id::text||g.price_dkk::text||g.extra_data::text,'|' order by g.id)) into price_fingerprint from public.generic_product_prices g where g.product_id=existing.id;`;
const apply = `begin;
do $apply$
declare ${payload}
p jsonb; r jsonb; added_value jsonb; existing public.products%rowtype; price_fingerprint text; changed integer;
begin
 for p in select value from jsonb_array_elements(plan->'products') loop
  select * into strict existing from public.products where id=(p->>'id')::uuid and tenant_id=(plan->>'tenantId')::uuid for update;
  if (to_jsonb(existing)-'updated_at') is distinct from ((p->'beforeProduct')-'updated_at') then raise exception 'Product changed since review: %',p->>'id'; end if;
  ${fingerprint}
  if price_fingerprint is distinct from (p->>'priceHash') then raise exception 'Prices changed since review: %',p->>'id'; end if;
  if (select jsonb_agg(to_jsonb(g)||jsonb_build_object('values',(select jsonb_agg(to_jsonb(v) order by v.sort_order,v.id) from public.product_attribute_values v where v.group_id=g.id)) order by g.sort_order,g.id) from public.product_attribute_groups g where g.product_id=existing.id) is distinct from (p->'beforeGroups') then raise exception 'Attributes changed since review: %',p->>'id'; end if;
  insert into public.product_attribute_groups (id,tenant_id,product_id,name,kind,ui_mode,source,sort_order,enabled) select x.id,x.tenant_id,x.product_id,x.name,x.kind,x.ui_mode,x.source,x.sort_order,x.enabled from jsonb_populate_record(null::public.product_attribute_groups,p->'group') x;
  for added_value in select value from jsonb_array_elements(p->'values') loop
   insert into public.product_attribute_values (id,tenant_id,product_id,group_id,name,key,sort_order,enabled) select x.id,x.tenant_id,x.product_id,x.group_id,x.name,x.key,x.sort_order,x.enabled from jsonb_populate_record(null::public.product_attribute_values,added_value) x;
  end loop;
  update public.products set pricing_structure=p->'afterPricingStructure',template_files=p->'afterTemplates' where id=existing.id and tenant_id=existing.tenant_id;
  for r in select value from jsonb_array_elements(p->'renames') loop
   update public.product_attribute_values set name=r->>'after' where id=(r->>'id')::uuid and product_id=existing.id and tenant_id=existing.tenant_id and name=r->>'before';
   get diagnostics changed=row_count;
   if changed<>1 then raise exception 'Format changed since review'; end if;
  end loop;
  ${fingerprint}
  if price_fingerprint is distinct from (p->>'priceHash') then raise exception 'Prices changed during integration'; end if;
 end loop;
end $apply$;
commit;`;
const rollback = `begin;
do $rollback$
declare ${payload}
p jsonb; r jsonb; existing public.products%rowtype;
begin
 for p in select value from jsonb_array_elements(plan->'products') loop
  select * into strict existing from public.products where id=(p->>'id')::uuid and tenant_id=(plan->>'tenantId')::uuid for update;
  if existing.pricing_structure is distinct from (p->'afterPricingStructure') or existing.template_files is distinct from (p->'afterTemplates') then raise exception 'Newer product edits exist; review rollback'; end if;
  update public.products set pricing_structure=p->'beforeProduct'->'pricing_structure',template_files=p->'beforeProduct'->'template_files' where id=existing.id and tenant_id=existing.tenant_id;
  for r in select value from jsonb_array_elements(p->'renames') loop
   update public.product_attribute_values set name=r->>'before' where id=(r->>'id')::uuid and product_id=existing.id and tenant_id=existing.tenant_id and name=r->>'after';
  end loop;
  update public.product_attribute_groups set enabled=false where id=(p->'group'->>'id')::uuid and product_id=existing.id and tenant_id=existing.tenant_id;
  update public.product_attribute_values set enabled=false where group_id=(p->'group'->>'id')::uuid and product_id=existing.id and tenant_id=existing.tenant_id;
 end loop;
end $rollback$;
commit;`;
fs.mkdirSync(args.output, { recursive: true });
fs.writeFileSync(path.join(args.output, 'plan.json'), JSON.stringify(plan, null, 2));
fs.writeFileSync(path.join(args.output, 'apply.sql'), apply);
fs.writeFileSync(path.join(args.output, 'rollback.sql'), rollback);
console.log(JSON.stringify({ products: plan.products.map(p => ({ slug: p.slug, ...p.summary })), checks: plan.checks }));
