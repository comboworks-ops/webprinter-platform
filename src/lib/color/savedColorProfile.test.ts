import test from 'node:test';
import assert from 'node:assert/strict';
import { readSavedColorProfile, withSavedColorProfile } from './savedColorProfile.ts';

test('saved profile identity round-trips while preserving source artwork and ICC-free JSON', () => {
    const artwork = { objects: [{ type: 'i-text', text: 'Blåbær ÆØÅ æøå' }], importedPdf: { bytes: [1, 2, 3] } };
    const before = JSON.stringify(artwork);
    const profile = { version: 1 as const, id: 'fogra52', name: 'PSO Uncoated v3', sha256: 'ab'.repeat(32), productionColorMode: 'preserve_rgb' as const };
    const saved = withSavedColorProfile(artwork, profile);
    assert.deepEqual(readSavedColorProfile(JSON.parse(JSON.stringify(saved))), profile);
    assert.equal(JSON.stringify(artwork), before);
    assert.strictEqual(saved.objects, artwork.objects);
    assert.deepEqual(readSavedColorProfile(artwork), null);
});

test('unknown saved identities are retained for explicit resolution, never replaced with FOGRA39', () => {
    assert.equal(readSavedColorProfile({ __webprinterColor: { version: 1, id: 'removed-profile', name: 'Old profile' } })?.id, 'removed-profile');
    assert.throws(() => readSavedColorProfile({ __webprinterColor: { version: 1, id: 'fogra51', name: 'Profile', sha256: 'bad' } }));
    assert.throws(() => readSavedColorProfile({ __webprinterColor: { version: 2, id: 'fogra51', name: 'Profile' } }));
    assert.throws(() => readSavedColorProfile({ __webprinterColor: { version: 1, id: 'fogra51', name: 'Profile', productionColorMode: 'bad' } }));
});
