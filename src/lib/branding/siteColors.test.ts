import type { BrandingData } from '@/hooks/useBrandingDraft';
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Exercise the real adapters/branding defaults while replacing only their network client.
// No environment files, credentials, live requests or browser storage are used.
const clientKey = '__brandingAdapterTestClient';
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '@/integrations/supabase/client') {
            return { url: `data:text/javascript,export const supabase = globalThis.${clientKey}`, shortCircuit: true };
        }
        const candidate = specifier.startsWith('@/')
            ? new URL(`../../${specifier.slice(2)}`, import.meta.url)
            : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
                ? new URL(specifier, context.parentURL) : null;
        if (candidate && !existsSync(candidate) && existsSync(`${fileURLToPath(candidate)}.ts`)) {
            return nextResolve(pathToFileURL(`${fileURLToPath(candidate)}.ts`).href, context);
        }
        return nextResolve(specifier, context);
    },
});

const { DEFAULT_BRANDING } = await import('../../hooks/useBrandingDraft.ts');
const { applySiteColor, buildSiteColorPatch, resetSiteColors, STANDARD_SITE_COLORS } = await import('./siteColors.ts');
const { readSharedButtons, legacyButtonStyle, resolveSharedButton } = await import('./sharedButtons.ts');
const { primaryButtonStyle } = await import('./primaryButtonStyle.ts');
const { createDraftHistory, draftHistoryReducer } = await import('./draftHistory.ts');
const fixture = (): BrandingData => {
    const draft = structuredClone(DEFAULT_BRANDING);
    draft.themeId = 'print-nordic';
    draft.colors = { ...draft.colors, ...STANDARD_SITE_COLORS };
    const stale = { ...legacyButtonStyle(draft, 'cta'), bgColor: '#CC0077', effect: 'sheen' as const };
    draft.themeSettings.sharedButtons = { version: 1, cta: stale, selection: { ...legacyButtonStyle(draft, 'selection'), selectedBgColor: '#CC0077' },
        bank: [{ id: 'saved', name: 'Saved', role: 'cta', style: stale }], overrides: { header: { role: 'cta', style: stale } } };
    draft.productPage.orderButtons.primary.gradientStart = '#CC0077';
    draft.productPage.orderButtons.primary.gradientEnd = '#CC0077';
    draft.forside.productsSection.button.gradientEnd = '#CC0077';
    return draft;
};

test('a full palette reaches active masters, gradients, selections and hover while preserving locked exceptions', () => {
    const draft = fixture(), before = structuredClone(draft);
    const next = { ...draft, ...buildSiteColorPatch(draft, { ...STANDARD_SITE_COLORS, primary: '#225500', hover: '#112200' }) };
    assert.equal(primaryButtonStyle(next)['--shop-action-bg'], '#225500');
    assert.equal(primaryButtonStyle(next)['--shop-action-hover'], '#112200');
    assert.equal(next.forside.productsSection.button.gradientEnd, '#225500');
    assert.equal(next.productPage.orderButtons.primary.gradientEnd, '#225500');
    assert.equal(next.productPage.orderButtons.primary.hoverGradientEnd, '#112200');
    assert.equal(next.forside.productsSection.featuredProductConfig.ctaHoverColor, '#112200');
    assert.equal(resolveSharedButton(next, 'selection')?.selectedBgColor, '#225500');
    assert.equal(resolveSharedButton(next, 'cta', 'header')?.bgColor, '#CC0077');
    assert.deepEqual(readSharedButtons(next).bank, readSharedButtons(draft).bank);
    assert.equal(resolveSharedButton(next, 'cta')?.effect, 'sheen');
    assert.deepEqual(draft, before);
});

test('single-role edits update their rendered consumers without replacing unrelated local styling', () => {
    const draft = fixture();
    draft.header.bgColor = '#ABCDEF';
    draft.productPage.pricePanel.backgroundColor = '#123456';
    const before = structuredClone(draft);
    const next = { ...draft, ...applySiteColor(draft, 'headingText', '#223344') };
    assert.equal(next.productPage.heading.color, '#223344');
    assert.equal(next.forside.productsSection.card.titleColor, '#223344');
    assert.equal(next.header.bgColor, '#ABCDEF');
    assert.equal(next.productPage.pricePanel.backgroundColor, '#123456');
    assert.deepEqual(next.colors.primary, draft.colors.primary);
    assert.deepEqual(readSharedButtons(next).cta, readSharedButtons(draft).cta);
    assert.deepEqual(readSharedButtons(next).overrides, readSharedButtons(draft).overrides);
    assert.equal(readSharedButtons(next).selection?.textColor, '#223344');
    assert.deepEqual(next.fonts, draft.fonts);
    assert.deepEqual(draft, before);
});

test('background and dropdown edits disable only their conflicting background mode', () => {
    const draft = fixture();
    draft.colors.backgroundType = 'image'; draft.colors.backgroundImageUrl = '/custom.jpg';
    const next = { ...draft, ...applySiteColor(draft, 'background', '#FFFEEE') };
    assert.equal(next.colors.backgroundType, 'solid');
    assert.equal(next.colors.backgroundImageUrl, null);
    assert.equal(next.forside.productsSection.background.color, '#FFFEEE');
    assert.equal(next.hero.images[0].url, draft.hero.images[0].url);
    const dropdown = { ...draft, ...applySiteColor(draft, 'dropdown', '#112233') };
    assert.equal(dropdown.header.dropdownBgColor, '#112233');
    assert.equal(dropdown.themeSettings.dropdownColorsCustomized, true);
    assert.equal(dropdown.colors.backgroundImageUrl, '/custom.jpg');
});

test('primary edits update brand-colored headers, active masters and later featured slides', () => {
    const draft = fixture(); draft.header.bgColor = draft.colors.primary;
    const featured = draft.forside.productsSection.featuredProductConfig;
    featured.slides = [{ id: 'second', config: { ...structuredClone(featured), productId: 'keep-me' } }];
    const next = { ...draft, ...applySiteColor(draft, 'primary', '#FFDD00') };
    assert.equal(next.header.bgColor, '#FFDD00');
    assert.equal(primaryButtonStyle(next)['--shop-action-bg'], '#FFDD00');
    assert.equal(resolveSharedButton(next, 'cta')?.textColor, '#0F172A');
    assert.equal(next.forside.productsSection.featuredProductConfig.slides?.[0].config.ctaColor, '#FFDD00');
    assert.equal(next.forside.productsSection.featuredProductConfig.slides?.[0].config.productId, 'keep-me');
    assert.equal(next.colors.hover, draft.colors.hover);
});

test('color-only reset preserves selected design, content and dimensions; unlocking is explicit and undo restores everything', () => {
    const draft = fixture(), before = structuredClone(draft);
    const next = { ...draft, ...resetSiteColors(draft) };
    assert.equal(next.themeId, 'print-nordic');
    assert.deepEqual(next.forside.layout, draft.forside.layout);
    assert.deepEqual(next.fonts, draft.fonts);
    assert.equal(next.hero.overlay.title, draft.hero.overlay.title);
    assert.deepEqual(next.header.navItems, draft.header.navItems);
    assert.equal(next.productPage.orderButtons.radiusPx, draft.productPage.orderButtons.radiusPx);
    assert.equal(resolveSharedButton(next, 'cta', 'header')?.bgColor, '#CC0077');
    const unlocked = { ...draft, ...resetSiteColors(draft, true) };
    assert.deepEqual(readSharedButtons(unlocked).overrides, {});
    assert.equal(resolveSharedButton(unlocked, 'cta', 'header')?.bgColor, '#087FC5');
    const edited = draftHistoryReducer(createDraftHistory(draft), { type: 'edit', value: unlocked });
    assert.deepEqual(draftHistoryReducer(edited, { type: 'undo' }).present, before);
    assert.deepEqual(draft, before);
});

test('invalid color input is ignored and a same-color background edit never mutates the draft', () => {
    const draft = fixture(), before = structuredClone(draft);
    assert.deepEqual(applySiteColor(draft, 'primary', 'not-a-color'), {});
    applySiteColor(draft, 'background', draft.colors.background);
    assert.deepEqual(draft, before);
});
