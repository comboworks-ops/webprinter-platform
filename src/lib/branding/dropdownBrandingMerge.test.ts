import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Run both real branding merge paths without creating a backend client.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/integrations/supabase/client') {
      return { url: 'data:text/javascript,export const supabase = {}', shortCircuit: true };
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

const { mergeBrandingWithDefaults: mergeStorefront } = await import('../../hooks/useBrandingDraft.ts');
const { mergeBrandingWithDefaults: mergeEditor } = await import('./types.ts');

test('both branding readers apply the new menu default even with an explicitly selected page theme', () => {
  for (const merge of [mergeStorefront, mergeEditor]) {
    for (const dropdownPreset of [undefined, 'classic'] as const) {
      const stored = {
        themeId: 'print-nordic',
        themeSettings: { visualStyleId: 'print-nordic' },
        header: { logoText: 'Tenant logo', bgColor: '#A83412', dropdownPreset },
      };
      const before = structuredClone(stored);
      const result = merge(stored as never);
      assert.equal(result.header.dropdownPreset, 'search-and-discover');
      assert.equal(result.themeId, 'print-nordic');
      assert.equal(result.header.logoText, 'Tenant logo');
      assert.equal(result.header.bgColor, '#A83412');
      assert.deepEqual(stored, before, 'read-time defaults never mutate stored branding');
    }
  }
});

test('both branding readers preserve selected new and legacy menus through inherited page branding', () => {
  for (const merge of [mergeStorefront, mergeEditor]) {
    for (const dropdownPreset of ['quick-list', 'focus-curtain', 'split-preview', 'gallery-cards'] as const) {
      const result = merge({ themeId: 'classic', header: { dropdownPreset } } as never);
      assert.equal(result.header.dropdownPreset, dropdownPreset);
      assert.equal(result.themeId, 'print-familiar');
      assert.equal(merge(result).header.dropdownPreset, dropdownPreset);
    }
  }
});
