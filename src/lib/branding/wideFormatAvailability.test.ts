import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usesWideFormat, WIDE_FORMAT_DESIGNS } from './wideFormatDesigns';
import { resolveWideFormatEditorBranding, wideFormatEditorPatch } from './wideFormatEditor';
import { signalSettings } from './pvcbannerSettings';
import type { BrandingData } from '@/hooks/useBrandingDraft';

const shops = [
  ['00000000-0000-0000-0000-000000000000', 'Webprinter'],
  ['7cb851f5-c792-40b1-a79a-1f7c7b5f668c', 'Online Tryksager'],
  ['7bbbba1c-dd82-4fd7-a280-ddaafbbdd8ba', 'Salgsmapper'],
  ['c8fbc728-4903-45a2-b9d2-181ba34313a1', 'Trykker'],
] as const;

function fixture(name: string): BrandingData {
  return {
    shop_name: name, themeId: 'print-form', logo_url: '/own-logo.png',
    themeSettings: { visualStyleId: 'print-form', custom: { retained: true }, orderFlowDesigns: { calculator: 2 } },
    colors: { primary: '#123456', background: '#ffffff' },
    fonts: { heading: 'Georgia', body: 'Arial', pricing: 'Inter' },
    header: { logoText: name }, hero: { images: [{ id: 'own', url: '/own-hero.png' }], overlay: { title: 'Our existing design' } },
    forside: { contentBlocks: [], lowerInfo: { enabled: false }, productsSection: { presentation: 'print-studio', studioBackgroundImageUrl: '/own-table.png' } },
    seoContent: { enabled: false, items: [] }, productPage: { protectedProductConfiguration: true },
  } as unknown as BrandingData;
}

for (const [id, name] of shops) {
  test(`${name}: opening and resolving branding leaves its existing design unchanged`, () => {
    const saved = fixture(name);
    const snapshot = structuredClone(saved);
    assert.equal(usesWideFormat(saved, id), false);
    assert.strictEqual(resolveWideFormatEditorBranding(saved, id), saved);
    assert.deepEqual(saved, snapshot);
  });

  test(`${name}: all five choices are opt-in and switching back restores its original design`, () => {
    const saved = fixture(name);
    const snapshot = structuredClone(saved);
    for (const design of WIDE_FORMAT_DESIGNS) {
      let draft: BrandingData = { ...saved, themeSettings: { ...saved.themeSettings, shopFamily: 'wide-format', wideFormatDesign: design.id } };
      assert.equal(usesWideFormat(draft, id), true);
      assert.equal(signalSettings(draft).brand, name);
      assert.equal(signalSettings(draft).logo, '/own-logo.png');
      assert.equal(signalSettings(draft).heroLink, '/produkter');
      const displayed = resolveWideFormatEditorBranding(draft, id);
      draft = { ...draft, ...wideFormatEditorPatch(draft, { hero: { ...displayed.hero, overlay: { ...displayed.hero.overlay, title: 'Wide-format edit' } } }, id) };
      const restored = JSON.parse(JSON.stringify(draft));
      assert.equal(resolveWideFormatEditorBranding(restored, id).hero.overlay.title, 'Wide-format edit');
      const conventional = { ...restored, ...wideFormatEditorPatch(restored, { themeSettings: { ...restored.themeSettings, shopFamily: 'webprinter' } }, id) };
      const result = resolveWideFormatEditorBranding(conventional, id);
      for (const key of ['themeId', 'logo_url', 'colors', 'fonts', 'header', 'hero', 'forside', 'productPage'] as const) {
        assert.deepEqual(result[key], saved[key], `${design.id}: ${key} preserved`);
      }
      assert.deepEqual(result.themeSettings.orderFlowDesigns, saved.themeSettings.orderFlowDesigns);
      assert.deepEqual(saved, snapshot, 'Stored branding was never edited');
    }
  });
}

test('PVCbanner retains its legacy wide-format default and any explicit conventional choice', () => {
  const pvc = 'cd3c7d7b-2220-46b8-93cf-096de23e93d8';
  const saved = fixture('PVCbanner.dk');
  const snapshot = structuredClone(saved);
  assert.equal(usesWideFormat(saved, pvc), true);
  resolveWideFormatEditorBranding(saved, pvc);
  assert.deepEqual(saved, snapshot);
  const conventional = { ...saved, themeSettings: { ...saved.themeSettings, shopFamily: 'webprinter' } };
  assert.strictEqual(resolveWideFormatEditorBranding(conventional, pvc), conventional);
});
