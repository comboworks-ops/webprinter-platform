import { OUTPUT_PROFILES, SRGB_INPUT_PROFILE, type ICCProfile } from './iccProofing.ts';
import { inspectIccProfile, MAX_ICC_PROFILE_BYTES, type IccProfileMetadata } from './iccValidation.ts';

export interface ResolvedColorProfile {
    id: string; name: string; bytes: ArrayBuffer; metadata: IccProfileMetadata;
    source: 'builtin' | 'product' | 'tenant';
}
export interface ResolveColorProfileOptions {
    id: string;
    tenantId?: string | null;
    productProfile?: { id: string; name: string; bytes: ArrayBuffer } | null;
    role?: 'cmyk_output' | 'rgb_working';
}
export interface TenantColorProfileRecord {
    id: string; tenant_id: string; name: string; kind: string; storage_path: string;
}
export interface ProfileResolverDependencies {
    fetchBytes?: (url: string) => Promise<ArrayBuffer>;
    getTenantProfile?: (id: string, tenantId: string) => Promise<TenantColorProfileRecord>;
    findInstalledProfile?: (sha256: string, tenantId: string) => Promise<TenantColorProfileRecord | null>;
    downloadTenantProfile?: (storagePath: string) => Promise<ArrayBuffer>;
    allowLocalProfiles?: boolean;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const loadBuiltin = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Den valgte standardprofil kunne ikke hentes.');
    if (Number(response.headers.get('content-length')) > MAX_ICC_PROFILE_BYTES) throw new Error('ICC-filen er for stor.');
    return response.arrayBuffer();
};
const getTenantProfile = async (id: string, tenantId: string): Promise<TenantColorProfileRecord> => {
    const { supabase } = await import('../../integrations/supabase/client');
    const { data, error } = await supabase.from('color_profiles' as never)
        .select('id, tenant_id, name, kind, storage_path').eq('id', id).eq('tenant_id', tenantId).single();
    if (error || !data) throw new Error('Den valgte farveprofil findes ikke i denne butik.');
    return data as unknown as TenantColorProfileRecord;
};
const findInstalledProfile = async (sha256: string, tenantId: string): Promise<TenantColorProfileRecord | null> => {
    const { supabase } = await import('../../integrations/supabase/client');
    const { data, error } = await supabase.from('color_profiles' as never)
        .select('id, tenant_id, name, kind, storage_path').eq('tenant_id', tenantId).eq('kind', 'cmyk_output')
        .like('storage_path', `%/${sha256}.icc`).order('created_at').limit(1).maybeSingle();
    if (error) throw new Error('Butikkens installerede standardprofiler kunne ikke kontrolleres.');
    return data as unknown as TenantColorProfileRecord | null;
};
const downloadTenantProfile = async (storagePath: string): Promise<ArrayBuffer> => {
    const { supabase } = await import('../../integrations/supabase/client');
    const { data, error } = await supabase.storage.from('color-profiles').download(storagePath);
    if (error || !data) throw new Error('Den valgte ICC-fil kunne ikke hentes.');
    if (data.size > MAX_ICC_PROFILE_BYTES) throw new Error('ICC-filen er for stor.');
    return data.arrayBuffer();
};
function validateTenantRecord(record: TenantColorProfileRecord, tenantId: string, role: string) {
    if (record.tenant_id !== tenantId || record.kind !== role || !record.storage_path.startsWith(`${tenantId}/`) || record.storage_path.includes('..')) {
        throw new Error('Farveprofilens butik, rolle eller filsti stemmer ikke.');
    }
}
export function installedRecipeForPath(storagePath: string): ICCProfile | undefined {
    return OUTPUT_PROFILES.find(profile => profile.sha256 && storagePath.endsWith(`/${profile.sha256}.icc`));
}

/** Exact ID -> validated bytes. Never substitute another profile on failure. */
export async function resolveColorProfile(options: ResolveColorProfileOptions, dependencies: ProfileResolverDependencies = {}): Promise<ResolvedColorProfile> {
    const { id, tenantId, productProfile, role = 'cmyk_output' } = options;
    if (!id) throw new Error('Vælg en farveprofil.');
    const builtin = role === 'rgb_working' ? (id === 'srgb' ? SRGB_INPUT_PROFILE : undefined) : OUTPUT_PROFILES.find(profile => profile.id === id);
    const validation = role === 'cmyk_output' ? { expectedColorSpace: 'CMYK' as const, expectedClass: 'prtr' as const } : { expectedColorSpace: 'RGB' as const };
    let bytes: ArrayBuffer;
    let name: string;
    let source: ResolvedColorProfile['source'];
    let expectedSha256 = builtin?.sha256;
    if (productProfile?.id === id) {
        bytes = productProfile.bytes.slice(0); name = productProfile.name; source = 'product';
    } else if (builtin && 'availability' in builtin && builtin.availability === 'install_required') {
        const record = tenantId && UUID.test(tenantId) && builtin.sha256
            ? await (dependencies.findInstalledProfile || findInstalledProfile)(builtin.sha256, tenantId) : null;
        if (record && tenantId) {
            validateTenantRecord(record, tenantId, role);
            bytes = await (dependencies.downloadTenantProfile || downloadTenantProfile)(record.storage_path);
            source = 'tenant';
        } else {
            const allowLocal = dependencies.allowLocalProfiles ?? Boolean(import.meta.env?.DEV);
            if (!allowLocal) throw new Error(`${builtin.name} skal installeres i denne butik under Farveprofiler. Hent filen fra den officielle kilde og upload den.`);
            bytes = await (dependencies.fetchBytes || loadBuiltin)(builtin.url);
            source = 'builtin';
        }
        name = builtin.name;
    } else if (builtin) {
        bytes = await (dependencies.fetchBytes || loadBuiltin)(builtin.url); name = builtin.name; source = 'builtin';
    } else {
        if (!UUID.test(id) || !tenantId || !UUID.test(tenantId)) throw new Error('Farveprofilen kan ikke indlæses uden en gyldig profil og butik.');
        const record = await (dependencies.getTenantProfile || getTenantProfile)(id, tenantId);
        if (record.id !== id) throw new Error('Farveprofilens identitet stemmer ikke.');
        validateTenantRecord(record, tenantId, role);
        bytes = await (dependencies.downloadTenantProfile || downloadTenantProfile)(record.storage_path);
        expectedSha256 = record.storage_path.match(/\/([a-f0-9]{64})\.icc$/i)?.[1];
        name = record.name; source = 'tenant';
    }
    const metadata = await inspectIccProfile(bytes, { ...validation, expectedSha256 });
    return { id, name, bytes, metadata, source };
}
