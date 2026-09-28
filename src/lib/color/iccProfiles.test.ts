import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inspectIccProfile, validateIccProfile, MAX_ICC_PROFILE_BYTES } from './iccValidation.ts';
import { resolveColorProfile, installedRecipeForPath, type TenantColorProfileRecord } from './profileResolver.ts';
import { getProductProfileSelection, readProductColorRecipe, PRINT_PROCESS_GUIDANCE, mergeProductColorSettings, sameProductColorSettings } from './profileGuidance.ts';
import { OUTPUT_PROFILES } from './iccProofing.ts';

const tenant = '00000000-0000-0000-0000-000000000001';
const profileId = '00000000-0000-0000-0000-000000000002';
function fixture(colorSpace = 'CMYK', deviceClass = 'prtr') {
    const bytes = new ArrayBuffer(160); const view = new DataView(bytes); const data = new Uint8Array(bytes);
    const word = (at: number, text: string) => data.set(new TextEncoder().encode(text), at);
    view.setUint32(0, bytes.byteLength); data[8] = 4; data[9] = 0x30;
    word(12, deviceClass); word(16, colorSpace.padEnd(4)); word(20, 'Lab '); word(36, 'acsp');
    view.setUint32(128, 1); word(132, 'wtpt'); view.setUint32(136, 144); view.setUint32(140, 16); word(144, 'XYZ ');
    return bytes;
}
function fileBytes(path: string) {
    const buffer = readFileSync(new URL(`../../../${path}`, import.meta.url));
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
const record = (changes: Partial<TenantColorProfileRecord> = {}): TenantColorProfileRecord => ({
    id: profileId, tenant_id: tenant, name: 'Custom press', kind: 'cmyk_output', storage_path: `${tenant}/${profileId}.icc`, ...changes,
});

test('actual bundled output and sRGB input files have correct roles and stable checksums', async () => {
    const output = await resolveColorProfile({ id: 'fogra39' }, { fetchBytes: async () => fileBytes('public/icc/ISOcoated_v2_300_eci.icc') });
    assert.equal(output.metadata.colorSpace, 'CMYK'); assert.equal(output.metadata.deviceClass, 'prtr');
    assert.equal(output.metadata.sha256, OUTPUT_PROFILES[0].sha256);
    const source = await resolveColorProfile({ id: 'srgb', role: 'rgb_working' }, { fetchBytes: async () => fileBytes('public/icc/sRGB_IEC61966-2-1.icc') });
    assert.equal(source.metadata.colorSpace, 'RGB');
    await assert.rejects(resolveColorProfile({ id: 'srgb' }), /gyldig profil/);
});
test('structural validation rejects malformed sizes, signatures, versions and role mismatch', () => {
    assert.throws(() => validateIccProfile(new ArrayBuffer(128)), /for lille/);
    assert.throws(() => validateIccProfile(new ArrayBuffer(MAX_ICC_PROFILE_BYTES + 1)), /16 MB/);
    for (const mutation of [
        (b: ArrayBuffer) => new DataView(b).setUint32(0, 999),
        (b: ArrayBuffer) => new Uint8Array(b)[36] = 0,
        (b: ArrayBuffer) => new Uint8Array(b)[8] = 5,
        (b: ArrayBuffer) => new DataView(b).setUint32(128, 1000),
        (b: ArrayBuffer) => new DataView(b).setUint32(136, 140),
        (b: ArrayBuffer) => new DataView(b).setUint32(140, 32),
    ]) { const bytes = fixture(); mutation(bytes); assert.throws(() => validateIccProfile(bytes)); }
    assert.throws(() => validateIccProfile(fixture('RGB', 'mntr'), { expectedColorSpace: 'CMYK' }), /kræver CMYK/);
    assert.throws(() => validateIccProfile(fixture('CMYK', 'link'), { expectedClass: 'prtr' }), /Profilklassen/);
});
test('checksum detects changed bytes even when ICC structure remains valid', async () => {
    const original = fixture(); const digest = (await inspectIccProfile(original)).sha256;
    new Uint8Array(original)[159] = 42;
    await assert.rejects(inspectIccProfile(original, { expectedSha256: digest }), /checksum/);
});
test('tenant profile resolves its own bytes instead of defaulting to FOGRA39', async () => {
    let requested = '';
    const result = await resolveColorProfile({ id: profileId, tenantId: tenant }, {
        getTenantProfile: async (id, scope) => { assert.equal(id, profileId); assert.equal(scope, tenant); return record(); },
        downloadTenantProfile: async path => { requested = path; return fixture(); },
        fetchBytes: async () => { throw new Error('must not fetch a default'); },
    });
    assert.equal(result.id, profileId); assert.equal(result.name, 'Custom press'); assert.equal(result.source, 'tenant');
    assert.equal(requested, `${tenant}/${profileId}.icc`);
});
test('cross-tenant metadata, wrong role, traversal, and different ID are rejected before download', async () => {
    for (const changed of [{ tenant_id: profileId }, { kind: 'rgb_working' }, { storage_path: `${tenant}/../secret.icc` }, { id: tenant }]) {
        await assert.rejects(resolveColorProfile({ id: profileId, tenantId: tenant }, {
            getTenantProfile: async () => record(changed), downloadTenantProfile: async () => { assert.fail('must not download'); },
        }));
    }
});
test('uploaded checksum paths detect replaced bytes', async () => {
    await assert.rejects(resolveColorProfile({ id: profileId, tenantId: tenant }, {
        getTenantProfile: async () => record({ storage_path: `${tenant}/${profileId}/${'0'.repeat(64)}.icc` }),
        downloadTenantProfile: async () => fixture(),
    }), /checksum/);
});
test('uninstalled ECI recipes fail explicitly in production without fetching local routes', async () => {
    await assert.rejects(resolveColorProfile({ id: 'fogra51', tenantId: tenant }, {
        allowLocalProfiles: false, findInstalledProfile: async () => null,
        fetchBytes: async () => { assert.fail('production cannot fetch a local ECI file'); },
    }), /skal installeres/);
});
test('installed ECI recipe cannot accept another profile with forged checksum metadata', async () => {
    const hash = OUTPUT_PROFILES.find(profile => profile.id === 'fogra51')!.sha256!;
    await assert.rejects(resolveColorProfile({ id: 'fogra51', tenantId: tenant }, {
        allowLocalProfiles: false, findInstalledProfile: async requested => { assert.equal(requested, hash); return record({ storage_path: `${tenant}/${hash}.icc` }); },
        downloadTenantProfile: async () => fixture(),
    }), /checksum/);
    assert.equal(installedRecipeForPath(`${tenant}/${hash}.icc`)?.id, 'fogra51');
});
test('unknown profile IDs and inaccessible files never fall back', async () => {
    await assert.rejects(resolveColorProfile({ id: 'missing' }), /gyldig profil/);
    await assert.rejects(resolveColorProfile({ id: profileId, tenantId: tenant }, {
        getTenantProfile: async () => { throw new Error('unavailable'); },
        fetchBytes: async () => { assert.fail('must not fetch fallback'); },
    }), /unavailable/);
});
test('built-in recipes and existing UUID assignments coexist without placing a string in the FK', () => {
    const recipe = { version: 1, process: 'offset_uncoated', sourceColorSpace: 'sRGB', outputProfileId: 'fogra52' };
    assert.equal(getProductProfileSelection({ output_color_profile_id: profileId }), profileId);
    assert.equal(getProductProfileSelection({ output_color_profile_id: profileId, technical_specs: { color_management: recipe } }), 'fogra52');
    assert.deepEqual(readProductColorRecipe({ color_management: recipe }), recipe);
    assert.equal(getProductProfileSelection({ technical_specs: { color_management: { ...recipe, outputProfileId: undefined } } }), null);
    assert.throws(() => getProductProfileSelection({ output_color_profile_id: profileId, technical_specs: { color_management: { ...recipe, version: 99 } } }), /ukendt format/);
});
test('device-specific workflows offer guidance without invented universal output profiles', () => {
    for (const id of ['wide_format', 'dtg_dtf', 'sublimation', 'screen_print']) {
        const entry = PRINT_PROCESS_GUIDANCE.find(process => process.id === id);
        assert.ok(entry); assert.equal('recommendedProfileId' in entry, false);
    }
});
test('color-only save preserves unrelated product, supplier, template and pricing metadata', () => {
    const specifications = { width_mm: 210, pod2_catalog_id: 'supplier-product', pricing_structure: { key: 'existing' }, template_files: ['template.pdf'], nested: { original: true } };
    const recipe = { version: 1 as const, process: 'offset_coated' as const, sourceColorSpace: 'sRGB' as const, outputProfileId: 'fogra51' };
    const patch = mergeProductColorSettings(specifications, recipe, null);
    const { color_management, ...unchanged } = patch.technical_specs;
    assert.deepEqual(unchanged, specifications); assert.deepEqual(color_management, recipe);
    assert.equal('color_management' in specifications, false);
    assert.equal(patch.output_color_profile_id, null);
    assert.deepEqual(mergeProductColorSettings(patch.technical_specs, null, profileId), { technical_specs: specifications, output_color_profile_id: profileId });
});
test('save contract rejects built-in strings in UUID FK and conflicting assignments', () => {
    const recipe = { version: 1 as const, process: 'offset_coated' as const, sourceColorSpace: 'sRGB' as const, outputProfileId: 'fogra51' };
    assert.throws(() => mergeProductColorSettings({}, null, 'fogra51'), /standardprofil/);
    assert.throws(() => mergeProductColorSettings({}, recipe, profileId), /enten/);
    assert.throws(() => mergeProductColorSettings({}, { ...recipe, outputProfileId: 'unknown' }, null), /ukendt/);
});
test('concurrent profile edits conflict while unrelated changes can merge safely', () => {
    const baseline = { output_color_profile_id: profileId, technical_specs: { width_mm: 100 } };
    assert.equal(sameProductColorSettings(baseline, { ...baseline, technical_specs: { width_mm: 250, unrelated: true } }), true);
    assert.equal(sameProductColorSettings(baseline, { ...baseline, output_color_profile_id: tenant }), false);
    assert.equal(sameProductColorSettings(baseline, { ...baseline, technical_specs: { color_management: { version: 1, process: 'wide_format', sourceColorSpace: 'sRGB' } } }), false);
});
test('supplier production mode is optional, round-trips independently of process and rejects unknown values', () => {
    const recipe = { version: 1 as const, process: 'wide_format' as const, sourceColorSpace: 'sRGB' as const };
    assert.equal(readProductColorRecipe({ color_management: recipe })?.productionColorMode, undefined);
    for (const productionColorMode of ['preserve_rgb', 'convert_cmyk'] as const) {
        const selected = { ...recipe, productionColorMode };
        const patch = mergeProductColorSettings({ width_mm: 900 }, selected, null);
        assert.deepEqual(readProductColorRecipe(patch.technical_specs), selected);
        assert.equal(sameProductColorSettings({ technical_specs: { color_management: recipe } }, patch), false);
    }
    const invalid = { ...recipe, productionColorMode: 'automatic_guess' };
    assert.equal(readProductColorRecipe({ color_management: invalid }), null);
    assert.throws(() => getProductProfileSelection({ technical_specs: { color_management: invalid } }), /ukendt format/);
    assert.throws(() => mergeProductColorSettings({}, invalid as never, null), /ukendt format/);
});
