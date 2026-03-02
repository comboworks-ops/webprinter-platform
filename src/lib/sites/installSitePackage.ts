import { supabase } from '@/integrations/supabase/client';
import type { SitePackage, SiteSeedLibraryItem, SiteTemplateType } from '@/lib/sites/sitePackages';

export interface SiteInstallSummary {
  planned: number;
  inserted: number;
  skipped: number;
  insertedByType: Record<SiteTemplateType, number>;
}

type DesignerTemplateRow = {
  tenant_id: string;
  name: string;
  description: string;
  template_type: SiteTemplateType;
  category: string;
  width_mm: number;
  height_mm: number;
  bleed_mm: number;
  safe_area_mm: number;
  is_public: boolean;
  is_active: boolean;
  icon_name: string;
  weight_gsm?: number | null;
};

const DEFAULT_BLEED_MM = 3;
const DEFAULT_SAFE_AREA_MM = 3;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function buildKey(row: { name: string; template_type: string; category: string }): string {
  return [normalize(row.template_type), normalize(row.category), normalize(row.name)].join('|');
}

function getCategory(siteName: string, templateType: SiteTemplateType): string {
  switch (templateType) {
    case 'format':
      return `Sites: ${siteName} / Formater`;
    case 'material':
      return `Sites: ${siteName} / Materialer`;
    case 'finish':
      return `Sites: ${siteName} / Efterbehandling`;
    case 'product':
      return `Sites: ${siteName} / Produkter`;
    default:
      return `Sites: ${siteName}`;
  }
}

function iconForType(templateType: SiteTemplateType): string {
  switch (templateType) {
    case 'format':
      return 'LayoutGrid';
    case 'material':
      return 'Layers';
    case 'finish':
      return 'Sparkles';
    case 'product':
      return 'Package';
    default:
      return 'FileText';
  }
}

function toLibraryTemplateRow(sitePackage: SitePackage, tenantId: string, seed: SiteSeedLibraryItem): DesignerTemplateRow {
  const category = seed.category || getCategory(sitePackage.name, seed.templateType);
  const row: DesignerTemplateRow = {
    tenant_id: tenantId,
    name: seed.name,
    description:
      seed.description || `Imported from ${sitePackage.name} [site:${sitePackage.id}]`,
    template_type: seed.templateType,
    category,
    width_mm: 0,
    height_mm: 0,
    bleed_mm: 0,
    safe_area_mm: 0,
    is_public: false,
    is_active: true,
    icon_name: iconForType(seed.templateType),
  };

  if (seed.templateType === 'material') {
    row.weight_gsm = seed.weightGsm ?? null;
  }

  return row;
}

function toFormatTemplateRows(sitePackage: SitePackage, tenantId: string): DesignerTemplateRow[] {
  return sitePackage.seedFormats.map((format) => ({
    tenant_id: tenantId,
    name: format.name,
    description:
      format.description || `Imported from ${sitePackage.name} [site:${sitePackage.id}]`,
    template_type: 'format' as const,
    category: getCategory(sitePackage.name, 'format'),
    width_mm: format.widthMm,
    height_mm: format.heightMm,
    bleed_mm: format.bleedMm ?? DEFAULT_BLEED_MM,
    safe_area_mm: format.safeAreaMm ?? DEFAULT_SAFE_AREA_MM,
    is_public: false,
    is_active: true,
    icon_name: 'LayoutGrid',
  }));
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function installSitePackageTemplates(params: {
  sitePackage: SitePackage;
  tenantId: string;
}): Promise<SiteInstallSummary> {
  const { sitePackage, tenantId } = params;

  const desiredRows: DesignerTemplateRow[] = [
    ...toFormatTemplateRows(sitePackage, tenantId),
    ...sitePackage.seedLibraryItems.map((seed) => toLibraryTemplateRow(sitePackage, tenantId, seed)),
  ];

  if (desiredRows.length === 0) {
    return {
      planned: 0,
      inserted: 0,
      skipped: 0,
      insertedByType: {
        format: 0,
        material: 0,
        finish: 0,
        product: 0,
      },
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('designer_templates' as any)
    .select('name, template_type, category')
    .eq('tenant_id', tenantId)
    .ilike('category', `Sites: ${sitePackage.name}%`);

  if (existingError) {
    throw existingError;
  }

  const existingKeys = new Set<string>((existingRows || []).map((row: any) => buildKey(row)));

  const rowsToInsert = desiredRows.filter((row) => !existingKeys.has(buildKey(row)));
  const insertedByType: Record<SiteTemplateType, number> = {
    format: 0,
    material: 0,
    finish: 0,
    product: 0,
  };

  if (rowsToInsert.length > 0) {
    const chunks = chunkArray(rowsToInsert, 100);
    for (const chunk of chunks) {
      let { error } = await supabase.from('designer_templates' as any).insert(chunk);
      if (error && String(error.message || '').toLowerCase().includes('weight_gsm')) {
        // Backward compatibility for databases that have not applied the weight_gsm migration.
        const fallbackChunk = chunk.map(({ weight_gsm, ...rest }) => rest);
        const retry = await supabase.from('designer_templates' as any).insert(fallbackChunk);
        error = retry.error;
      }
      if (error) throw error;

      chunk.forEach((row) => {
        insertedByType[row.template_type] += 1;
      });
    }
  }

  return {
    planned: desiredRows.length,
    inserted: rowsToInsert.length,
    skipped: desiredRows.length - rowsToInsert.length,
    insertedByType,
  };
}
