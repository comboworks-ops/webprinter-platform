type Settings = Record<string, any>;
const owns = (value: Settings, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value: unknown): Settings | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Settings : undefined;

function flatBranding(value: unknown): Settings | undefined {
    const branding = object(value);
    if (!branding) return undefined;
    const { draft: _draft, published: _published, history: _history, savedDesigns: _saved, ...flat } = branding;
    return Object.keys(flat).length ? flat : undefined;
}

/** An unpublished draft must never be used as storefront branding. Explicit null
 * marks a new shop without a publication; old flat/root data remains readable. */
export function extractPublishedBranding(settings: Settings | null | undefined): Settings | undefined {
    const branding = object(settings?.branding);
    if (branding && owns(branding, 'published')) return object(branding.published);
    return object(settings?.branding_published) || flatBranding(branding);
}

export function extractDraftBranding(settings: Settings | null | undefined): Settings {
    const branding = object(settings?.branding);
    const published = extractPublishedBranding(settings);
    // A nested draft is authoritative even when legacy root values remain.
    const draft = branding && owns(branding, 'draft') ? object(branding.draft)
        : branding && owns(branding, 'published') ? undefined : object(settings?.branding_draft);
    return { ...published, ...draft };
}

/** Preserve the previous publication when moving a legacy shop into the nested
 * format. Keep archive metadata; canonical keys take precedence on every read. */
export function normalizedBrandingContainer(settings: Settings): Settings {
    return {
        ...object(settings.branding),
        published: extractPublishedBranding(settings) ?? null,
        draft: extractDraftBranding(settings),
    };
}

export class BrandingSettingsWriteError extends Error {}

/** Compare the exact JSON read by this operation, so another settings writer
 * cannot be silently overwritten. A narrow invoker RPC keeps large archived
 * designs in the request body and retains existing tenant grants/RLS.
 * A denied/zero-row update is a failure, never a successful Save/Publish. */
export async function persistBrandingSettings(
    client: { rpc: (...args: any[]) => any },
    tenantId: string,
    previousSettings: unknown,
    nextSettings: Settings,
): Promise<void> {
    if (previousSettings === undefined) throw new BrandingSettingsWriteError('Shoppens indstillinger kunne ikke indlæses. Genindlæs og prøv igen.');
    const keys = ['branding', 'branding_template_draft', 'branding_template_published', 'branding_template_history', 'branding_template_savedDesigns'];
    const patch = Object.fromEntries(keys.filter(key => owns(nextSettings, key)).map(key => [key, nextSettings[key]]));
    const { data, error } = await client.rpc('tenant_branding_settings_compare_and_swap', {
        p_tenant_id: tenantId,
        p_expected_settings: previousSettings,
        p_branding_patch: patch,
    }).maybeSingle();
    if (error) throw error;
    if (data?.id !== tenantId) {
        throw new BrandingSettingsWriteError('Indstillingerne blev ikke gemt. De kan være ændret i et andet vindue, eller du mangler adgang. Genindlæs før du prøver igen.');
    }
}
