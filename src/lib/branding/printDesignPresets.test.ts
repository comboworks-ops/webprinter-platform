import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPrintDesignPreset, getPrintDesignPreset, inheritSystemPrintDesign, resolvePrintDesignBranding, selectPrintDesignPreset, DEFAULT_PRINT_DESIGN_ID, PRINT_DESIGN_PRESETS, PRINT_HOME_DESIGN_CHOICES, PRINT_DESIGN_PALETTES } from './printDesignPresets.ts';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { APPROVED_DROPDOWN_PRESETS, LEGACY_DROPDOWN_PRESETS } from './dropdownPresets.ts';
import { DEFAULT_STOREFRONT_LAYOUT } from '../storefront/shopTemplates.ts';

type TenantBrandingFixture = BrandingData & { shop_name: string };

function fixture(): TenantBrandingFixture {
  return {
    themeId: 'classic', themeSettings: { customSetting: 'keep' }, logo_url: '/my-logo.png', shop_name: 'Min shop',
    fonts: {}, colors: {}, header: { logoText: 'Min shop', navItems: [{ id: 'mine', label: 'Mine produkter', href: '/mine' }], scroll: {} },
    hero: { images: [{ id: 'original', url: '/original.jpg' }], overlay: { title: 'Vores eget budskab', subtitle: 'Min egen tekst' } },
    forside: { productsSection: { button: {}, card: {}, featuredProductConfig: { enabled: true, productId: 'existing-product', quantityPresets: [1,5,10], customDescription: 'Egen produkttekst', sidePanel: { enabled: true, title: 'Gem denne kampagne' } } } },
    productPage: { existingPriceConfiguration: 'untouched' },
  } as unknown as TenantBrandingFixture;
}

test('selected collection preserves identity, product configuration and authored copy across all designs', () => {
  const draft = fixture();
  const before = structuredClone(draft);
  for (const preset of PRINT_DESIGN_PRESETS) {
    const result = applyPrintDesignPreset(draft, preset.id);
    assert.equal(result.logo_url, draft.logo_url);
    assert.equal(result.header.logoText, draft.header.logoText);
    assert.equal(result.header.navItems, draft.header.navItems);
    assert.equal(result.productPage, draft.productPage);
    assert.equal(result.hero.overlay.title, 'Vores eget budskab');
    assert.equal(result.forside.productsSection.featuredProductConfig.productId, 'existing-product');
    assert.deepEqual(result.forside.productsSection.featuredProductConfig.quantityPresets, [1,5,10]);
    assert.equal(result.forside.productsSection.featuredProductConfig.sidePanel?.title, 'Gem denne kampagne');
    assert.equal(result.themeSettings.customSetting, 'keep');
  }
  assert.deepEqual(draft, before, 'selection must never mutate the stored or original draft');
});

test('explicit shop-design selection restores its storefront composition without changing product data', () => {
  const draft = fixture();
  draft.forside.layout = { ...DEFAULT_STOREFRONT_LAYOUT,
    sectionOrder: ['products', 'hero', 'banner2', 'content', 'usp', 'seo'] };
  draft.forside.productsSection.presentation = 'precision-catalogue';
  const before = structuredClone(draft);

  for (const preset of PRINT_DESIGN_PRESETS) {
    const result = selectPrintDesignPreset(draft, preset.id);
    assert.equal(result.themeId, preset.id);
    assert.equal(result.forside.productsSection.presentation, 'standard');
    assert.equal(result.forside.layout.sectionOrder[0], preset.hero ? 'hero' : 'products');
    assert.equal(result.forside.productsSection.featuredProductConfig.productId, 'existing-product');
    assert.equal(result.hero.overlay.title, 'Vores eget budskab');
  }
  assert.deepEqual(draft, before);

  const plain = { ...draft, forside: { ...draft.forside, productsSection: {
    ...draft.forside.productsSection, presentation: 'standard' as const,
  } } };
  assert.deepEqual(selectPrintDesignPreset(plain, 'print-nordic').forside.layout.sectionOrder, plain.forside.layout.sectionOrder);
  assert.equal(selectPrintDesignPreset(draft, 'unknown'), draft);
});

test('the original concept order makes Refined Familiar picture one and the system default', () => {
  assert.equal(DEFAULT_PRINT_DESIGN_ID, 'print-familiar');
  assert.deepEqual(PRINT_DESIGN_PRESETS.slice(0,5).map(({ number, id }) => [number, id]), [
    [1, 'print-familiar'], [2, 'print-product'], [3, 'print-nordic'],
    [4, 'print-precise'], [5, 'print-calm'],
  ]);
  assert.equal(PRINT_DESIGN_PRESETS[0].id, DEFAULT_PRINT_DESIGN_ID);
});

test('renumbering keeps each design paired with its original hero, header and preview artwork', () => {
  const expected = [
    { id: 'print-familiar', hero: 'familiar', blueHeader: true, previewImage: '/design-presets/preview-2.webp' },
    { id: 'print-product', hero: null, blueHeader: false, previewImage: '/design-presets/preview-4.webp' },
    { id: 'print-nordic', hero: 'nordic', blueHeader: false, previewImage: '/design-presets/preview-3.webp' },
    { id: 'print-precise', hero: 'precise', blueHeader: false, previewImage: '/design-presets/preview-1.webp' },
    { id: 'print-calm', hero: 'calm', blueHeader: true, previewImage: '/design-presets/preview-5.webp' },
  ];
  assert.deepEqual(PRINT_DESIGN_PRESETS.slice(0,5).map(({ id, hero, blueHeader, previewImage }) => ({ id, hero, blueHeader, previewImage })), expected);
  for (const { id, hero, blueHeader } of expected) {
    const result = applyPrintDesignPreset(fixture(), id);
    assert.equal(result.header.bgColor, blueHeader ? '#087FC5' : '#FFFFFF');
    assert.equal(result.hero.images[0].url, hero ? `/design-presets/${hero}-hero.webp` : '/original.jpg');
  }
});

test('existing explicit theme choices and customization remain unchanged', () => {
  const classic = fixture();
  assert.equal(resolvePrintDesignBranding(classic), classic);
  const defaults = { ...classic, themeId: DEFAULT_PRINT_DESIGN_ID };
  assert.equal(resolvePrintDesignBranding(defaults).themeSettings.visualThemePresetId, DEFAULT_PRINT_DESIGN_ID);
  const chosen = applyPrintDesignPreset(defaults, 'print-calm');
  chosen.colors.primary = '#123456';
  assert.equal(resolvePrintDesignBranding(chosen).colors.primary, '#123456');
});

test('switching presets updates stock copy and retains the original artwork for recovery', () => {
  const draft = fixture();
  draft.hero.overlay.title = 'Billige tryksager online';
  const one = applyPrintDesignPreset(draft, 'print-precise');
  const two = applyPrintDesignPreset(one, 'print-familiar');
  assert.equal(two.hero.overlay.title, getPrintDesignPreset('print-familiar')?.title);
  assert.deepEqual(two.themeSettings.printPreviousHeroImages, draft.hero.images);
  assert.equal(applyPrintDesignPreset(two, 'unknown'), two);
});

function systemDefaults(): TenantBrandingFixture {
  const defaults = fixture();
  return {
    ...defaults, themeId: DEFAULT_PRINT_DESIGN_ID, themeSettings: {},
    fonts: { heading: 'Poppins', body: 'Inter', pricing: 'Roboto Mono' },
    colors: { ...defaults.colors, primary: '#0EA5E9', pricingText: '#0EA5E9', linkText: '#0EA5E9' },
    header: { ...defaults.header, bgColor: '#FFFFFF', textColor: '#111827', fontId: 'Poppins', height: 'md' },
    hero: { ...defaults.hero, images: [{ ...defaults.hero.images[0], url: '/hero-print.jpg' }], overlay: { ...defaults.hero.overlay, title: 'Billige tryksager online', subtitle: 'Standardtekst' } },
    forside: { ...defaults.forside, productsSection: { ...defaults.forside.productsSection,
      button: { ...defaults.forside.productsSection.button, bgColor: '#0EA5E9', textColor: '#FFFFFF' },
      featuredProductConfig: { ...defaults.forside.productsSection.featuredProductConfig, ctaColor: '#0EA5E9', ctaTextColor: '#FFFFFF' },
    } },
  };
}

test('changing a whole storefront theme preserves every deliberately selected menu', () => {
  const choices = [...APPROVED_DROPDOWN_PRESETS.map(preset => preset.id), ...LEGACY_DROPDOWN_PRESETS.filter(id => id !== 'classic')];
  for (const menu of choices) {
    const draft = fixture();
    draft.header.dropdownPreset = menu;
    const before = structuredClone(draft);
    for (const theme of PRINT_DESIGN_PRESETS) {
      const result = applyPrintDesignPreset(draft, theme.id);
      assert.equal(result.header.dropdownPreset, menu, `${theme.id} must preserve ${menu}`);
      assert.equal(result.header.navItems, draft.header.navItems);
    }
    assert.deepEqual(draft, before);
  }
});

test('whole storefront themes give legacy default menus the approved Search & Discover default', () => {
  for (const menu of [undefined, 'classic'] as const) {
    const draft = fixture();
    draft.header.dropdownPreset = menu;
    for (const theme of PRINT_DESIGN_PRESETS) {
      assert.equal(applyPrintDesignPreset(draft, theme.id).header.dropdownPreset, 'search-and-discover');
    }
  }
});

test('missing and unmarked legacy themes inherit picture one for every tenant', () => {
  const defaults = systemDefaults();
  for (const tenantId of ['00000000-0000-0000-0000-000000000000', 'tenant-a', 'tenant-b']) {
    for (const themeId of [undefined, '', 'classic', DEFAULT_PRINT_DESIGN_ID]) {
      const source = { ...defaults, tenantId, themeId } as BrandingData;
      const before = structuredClone(source);
      const result = inheritSystemPrintDesign(source, defaults);
      assert.equal(result.themeId, DEFAULT_PRINT_DESIGN_ID);
      assert.equal(result.themeSettings.inheritedPrintDesignId, DEFAULT_PRINT_DESIGN_ID);
      assert.equal(result.hero.images[0].url, '/design-presets/familiar-hero.webp');
      assert.equal(result.header.bgColor, '#087FC5');
      assert.equal((result as BrandingData & { tenantId: string }).tenantId, tenantId);
      assert.equal(inheritSystemPrintDesign(result, defaults), result, 'normalization must be idempotent');
      assert.deepEqual(source, before, 'inheritance must not mutate stored branding');
    }
  }
});

test('explicit print designs and earlier theme choices keep their full branding', () => {
  const defaults = systemDefaults();
  for (const themeId of [...PRINT_DESIGN_PRESETS.map(preset => preset.id), 'classic', 'glassmorphism', 'taste-minimal']) {
    for (const selection of [{ visualThemePresetId: themeId }, { visualStyleId: themeId }]) {
      const chosen = { ...defaults, themeId, themeSettings: selection };
      assert.equal(inheritSystemPrintDesign(chosen, defaults), chosen);
    }
    if (themeId !== 'classic' && themeId !== DEFAULT_PRINT_DESIGN_ID) {
      const oldChoice = { ...defaults, themeId };
      assert.equal(inheritSystemPrintDesign(oldChoice, defaults), oldChoice);
    }
  }
});

test('storefront rendering preserves an explicit visualStyleId without reapplying its preset', () => {
  const chosen = fixture();
  chosen.themeId = 'print-nordic';
  chosen.themeSettings.visualStyleId = 'print-nordic';
  chosen.colors.primary = '#C45A18';
  assert.equal(resolvePrintDesignBranding(chosen), chosen);
  assert.equal(chosen.hero.images[0].url, '/original.jpg');
});

test('inherited design preserves tenant content and applies custom primary only to default colour controls', () => {
  const defaults = systemDefaults();
  const source = fixture();
  source.colors = { ...defaults.colors, primary: '#C45A18', linkText: '#6C2511' };
  source.fonts = { ...defaults.fonts, heading: 'Georgia' };
  source.header = { ...defaults.header, ...source.header, bgColor: defaults.header.bgColor, height: 'lg' };
  source.forside.productsSection.button = { ...defaults.forside.productsSection.button };
  source.forside.productsSection.featuredProductConfig.ctaColor = '#752E15';
  source.themeSettings.orderFlowDesigns = { product: 2, checkout: 6 };
  const before = structuredClone(source);
  const result = inheritSystemPrintDesign(source, defaults);
  assert.equal(result.logo_url, source.logo_url);
  assert.ok('shop_name' in result, 'tenant-specific identity fields must survive inheritance');
  assert.equal(result.shop_name, source.shop_name);
  assert.equal(result.header.navItems, source.header.navItems);
  assert.equal(result.hero.overlay.title, source.hero.overlay.title);
  assert.equal(result.hero.overlay.subtitle, source.hero.overlay.subtitle);
  assert.equal(result.hero.images, source.hero.images);
  assert.equal(result.fonts.heading, 'Georgia');
  assert.equal(result.fonts.pricing, 'Inter', 'stock font can adopt the new design');
  assert.equal(result.header.height, 'lg');
  assert.equal(result.colors.primary, '#C45A18');
  assert.equal(result.header.bgColor, '#C45A18');
  assert.equal(result.colors.pricingText, '#C45A18');
  assert.equal(result.colors.linkText, '#6C2511');
  assert.equal(result.forside.productsSection.button.bgColor, '#C45A18');
  assert.equal(result.forside.productsSection.featuredProductConfig.ctaColor, '#752E15');
  assert.equal(result.forside.productsSection.featuredProductConfig.productId, source.forside.productsSection.featuredProductConfig.productId);
  assert.equal(result.forside.productsSection.featuredProductConfig.quantityPresets, source.forside.productsSection.featuredProductConfig.quantityPresets);
  assert.equal(result.productPage, source.productPage);
  assert.equal(result.themeSettings.orderFlowDesigns, source.themeSettings.orderFlowDesigns);
  assert.deepEqual(source, before);
});

test('inherited earlier defaults can follow the standard while subsequent explicit selections remain selected', () => {
  const defaults = systemDefaults();
  const previous = applyPrintDesignPreset(defaults, 'print-precise');
  previous.themeSettings.inheritedPrintDesignId = 'print-precise';
  const inherited = inheritSystemPrintDesign(previous, defaults);
  assert.equal(inherited.themeId, DEFAULT_PRINT_DESIGN_ID);
  assert.equal(inherited.hero.images[0].url, '/design-presets/familiar-hero.webp');
  const chosen = applyPrintDesignPreset(inherited, 'print-nordic');
  assert.equal(chosen.themeSettings.inheritedPrintDesignId, undefined);
  assert.equal(inheritSystemPrintDesign(chosen, defaults), chosen);
  const classic = { ...inherited, themeId: 'classic', themeSettings: { ...inherited.themeSettings, visualStyleId: 'classic', visualThemePresetId: 'classic' } };
  assert.equal(inheritSystemPrintDesign(classic, defaults), classic);
  const partialChange = { ...previous, themeSettings: { ...previous.themeSettings, visualStyleId: 'classic' } };
  assert.equal(inheritSystemPrintDesign(partialChange, defaults), partialChange, 'all inherited identifiers must match before following the standard');
});

test('each selected print preset supplies readable banner text with its background artwork', () => {
  for(const preset of PRINT_DESIGN_PRESETS) {
    const result=applyPrintDesignPreset(fixture(),preset.id);
    assert.equal(result.hero.overlay.titleColor,['print-familiar','print-signal'].includes(preset.id) ? '#FFFFFF' : (PRINT_DESIGN_PALETTES[preset.id]?.ink || '#0B1933'));
    assert.equal(result.hero.overlay.subtitleColor,['print-familiar','print-signal'].includes(preset.id) ? '#FFFFFF' : '#4B5565');
  }
});


test('four additional designs register independently and round-trip through saved branding', () => {
  const additional = PRINT_DESIGN_PRESETS.slice(5);
  assert.deepEqual(additional.map(p => p.id), ['print-atelier','print-signal','print-form','print-partner']);
  for (const preset of additional) {
    const draft = fixture();
    const selected = selectPrintDesignPreset(draft, preset.id);
    const reloaded = JSON.parse(JSON.stringify(selected));
    assert.equal(resolvePrintDesignBranding(reloaded), reloaded);
    assert.equal(reloaded.themeId, preset.id);
    assert.equal(reloaded.themeSettings.visualStyleId, preset.id);
    assert.equal(reloaded.colors.primary, PRINT_DESIGN_PALETTES[preset.id].primary);
    assert.deepEqual(selected.productPage, draft.productPage);
  }
});


test('Printstudio is a homepage choice using the existing presentation and preserved branding', () => {
  const original = fixture();
  original.forside.layout = { ...DEFAULT_STOREFRONT_LAYOUT };
  original.colors.primary = '#a13579';
  const before = structuredClone(original);
  const selected = JSON.parse(JSON.stringify(selectPrintDesignPreset(original, 'print-studio')));
  assert.equal(PRINT_HOME_DESIGN_CHOICES.filter(item => item.id === 'print-studio').length, 1);
  assert.equal(selected.forside.productsSection.presentation, 'print-studio');
  assert.equal(selected.forside.layout.sectionOrder[0], 'products');
  assert.equal(selected.themeId, original.themeId);
  assert.deepEqual(selected.header, original.header);
  assert.deepEqual(selected.colors, original.colors);
  assert.deepEqual(selected.fonts, original.fonts);
  assert.deepEqual(selected.hero, original.hero);
  assert.deepEqual(selected.forside.productsSection.featuredProductConfig, original.forside.productsSection.featuredProductConfig);
  assert.deepEqual(selected.productPage, original.productPage);
  assert.deepEqual(original, before);
  for (const preset of PRINT_DESIGN_PRESETS) {
    const next = selectPrintDesignPreset(selected, preset.id);
    assert.equal(next.themeId, preset.id);
    assert.equal(next.forside.productsSection.presentation, 'standard');
    assert.equal(next.forside.productsSection.featuredProductConfig.productId, original.forside.productsSection.featuredProductConfig.productId);
  }
});
