import { OUTPUT_PROFILES } from './iccProofing.ts';

export const PRINT_PROCESS_GUIDANCE = [
    { id: 'unspecified', label: 'Ikke aftalt med trykkeriet', guidance: 'Aftal filformat, farverum og materiale med trykkeriet. En soft proof-profil er en forhåndsvisning, ikke en produktionsaftale.' },
    { id: 'offset_coated', label: 'Offset – bestrøget papir', recommendedProfileId: 'fogra51', guidance: 'PSO Coated v3 / FOGRA51 til den aftalte moderne trykbetingelse. Behold FOGRA39 300%, når leverandøren kræver den.' },
    { id: 'offset_uncoated', label: 'Offset – ubestrøget papir', recommendedProfileId: 'fogra52', guidance: 'PSO Uncoated v3 / FOGRA52 til den aftalte ubestrøgne trykbetingelse med optisk hvidt. Kontroller det konkrete papir.' },
    { id: 'digital_paper', label: 'Digitaltryk på papir', guidance: 'Følg trykkeriets krav til RGB eller CMYK. Maskinens kalibrering og outputprofil styres i produktionen.' },
    { id: 'wide_format', label: 'Storformat, skilte og folie', guidance: 'Kræver profil til printer, blæk, materiale og printindstilling. Der findes ikke én generel storformatprofil. Brug leverandørens filkrav.' },
    { id: 'dtg_dtf', label: 'Tøj – DTG / DTF', guidance: 'Brug sRGB, når leverandøren kræver det. Tekstil, tøjets farve og hvid underbase påvirker resultatet. En offsetprofil er kun en eventuel simulation.' },
    { id: 'sublimation', label: 'Sublimation', guidance: 'Profil og overførsel skal passe til printer, blæk, papir og slutprodukt. Følg leverandørens indstillinger og farverum.' },
    { id: 'screen_print', label: 'Serigrafi', guidance: 'Aftal staffagefarver og separationer. En almindelig CMYK-profil laver ikke automatisk de nødvendige trykseparationer.' },
] as const;
export type PrintProcess = typeof PRINT_PROCESS_GUIDANCE[number]['id'];
export interface ProductColorRecipe {
    version: 1;
    process: PrintProcess;
    sourceColorSpace: 'sRGB';
    /** Explicit supplier requirement; absent preserves the existing process default. */
    productionColorMode?: 'convert_cmyk' | 'preserve_rgb';
    /** Recipe IDs only; uploaded UUIDs remain in products.output_color_profile_id. */
    outputProfileId?: string;
}
export function readProductColorRecipe(technicalSpecs: unknown): ProductColorRecipe | null {
    if (!technicalSpecs || typeof technicalSpecs !== 'object') return null;
    const candidate = (technicalSpecs as Record<string, unknown>).color_management;
    if (!candidate || typeof candidate !== 'object') return null;
    const value = candidate as Record<string, unknown>;
    if (value.version !== 1 || value.sourceColorSpace !== 'sRGB' ||
        !PRINT_PROCESS_GUIDANCE.some(process => process.id === value.process)) return null;
    if (value.productionColorMode !== undefined && value.productionColorMode !== 'convert_cmyk' && value.productionColorMode !== 'preserve_rgb') return null;
    return { version: 1, process: value.process as PrintProcess, sourceColorSpace: 'sRGB',
        // Unknown saved IDs must fail explicitly at resolution rather than change the output.
        ...(typeof value.outputProfileId === 'string' && value.outputProfileId ? { outputProfileId: value.outputProfileId } : {}),
        ...(value.productionColorMode ? { productionColorMode: value.productionColorMode as ProductColorRecipe['productionColorMode'] } : {}),
    };
}
export function getProductProfileSelection(product: { output_color_profile_id?: string | null; technical_specs?: unknown }): string | null {
    const recipe = readProductColorRecipe(product.technical_specs);
    if (product.technical_specs && typeof product.technical_specs === 'object' &&
        (product.technical_specs as Record<string, unknown>).color_management != null && !recipe) {
        throw new Error('Produktets farveindstillinger har et ukendt format. Kontroller dem i produktadministrationen.');
    }
    return recipe?.outputProfileId || product.output_color_profile_id || null;
}
export function getPrintProcessGuidance(process: PrintProcess) {
    return PRINT_PROCESS_GUIDANCE.find(item => item.id === process) || PRINT_PROCESS_GUIDANCE[0];
}
export function isBuiltInOutputProfile(id: string): boolean {
    return OUTPUT_PROFILES.some(profile => profile.id === id);
}

export function mergeProductColorSettings(technicalSpecs: unknown, recipe: ProductColorRecipe | null, uploadedProfileId: string | null) {
    if (recipe && !readProductColorRecipe({ color_management: recipe })) throw new Error('Farveindstillingerne har et ukendt format.');
    if (uploadedProfileId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadedProfileId)) {
        throw new Error('En standardprofil må ikke gemmes i feltet til uploadede profil-IDer.');
    }
    if (recipe?.outputProfileId && !isBuiltInOutputProfile(recipe.outputProfileId)) throw new Error('Standardprofilen er ukendt.');
    if (recipe?.outputProfileId && uploadedProfileId) throw new Error('Vælg enten en standardprofil eller en uploadet profil.');
    const next = technicalSpecs && typeof technicalSpecs === 'object' && !Array.isArray(technicalSpecs)
        ? { ...technicalSpecs as Record<string, unknown> } : {};
    if (recipe) next.color_management = { ...recipe };
    else delete next.color_management;
    return { technical_specs: next, output_color_profile_id: uploadedProfileId };
}

export function sameProductColorSettings(left: { technical_specs?: unknown; output_color_profile_id?: string | null }, right: { technical_specs?: unknown; output_color_profile_id?: string | null }): boolean {
    return (left.output_color_profile_id || null) === (right.output_color_profile_id || null) &&
        JSON.stringify(readProductColorRecipe(left.technical_specs)) === JSON.stringify(readProductColorRecipe(right.technical_specs));
}
