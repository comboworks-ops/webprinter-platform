import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  Ruler,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { SITE_PACKAGE_MAP, type SitePackage } from '@/lib/sites/sitePackages';
import { supabase } from '@/integrations/supabase/client';
import { isProductAssignedToSite } from '@/lib/sites/productSiteFrontends';
import {
  cloneStandardDeliveryMethods,
  resolveDeliveryMethodCost,
} from '@/lib/delivery/defaults';

interface SitePackagePreviewProps {
  siteId: string;
  tenantId?: string | null;
}

type SitePreviewManifest = {
  mode?: 'mock' | 'iframe';
  entry?: string;
  heroImage?: string;
  galleryImages?: string[];
  headline?: string;
  subline?: string;
  palette?: Partial<PreviewPalette>;
};

type PreviewPalette = {
  bg: string;
  bgSoft: string;
  text: string;
  mutedText: string;
  panel: string;
  border: string;
  heroGradient: string;
  primary: string;
  secondary: string;
  heroImage: string;
};

type RuntimeSiteProduct = {
  id: string;
  slug: string;
  name: string;
  pricingType?: string | null;
  description?: string | null;
  iconText?: string | null;
  imageUrl?: string | null;
  buttonKey?: string | null;
  buttonOrder?: number | null;
  buttonLabel?: string | null;
  buttonDescription?: string | null;
  buttonImageUrl?: string | null;
  activeFinishIds?: string[];
  activeProductItemIds?: string[];
  deliveryMethods?: RuntimeSiteDeliveryMethod[];
  storformat?: RuntimeSiteStorformatData | null;
};

type RuntimeSiteDeliveryMethod = {
  id: string;
  name: string;
  description?: string | null;
  leadTimeDays?: number | null;
  cutoffTime?: string | null;
  cutoffLabel?: string | null;
  submission?: string | null;
  deliveryDate?: string | null;
  price: number;
};

type RuntimeSiteStorformatConfig = {
  roundingStep: number;
  globalMarkupPct: number;
  quantities: number[];
};

type RuntimeSiteStorformatMaterial = {
  id: string;
  name: string;
  interpolationEnabled: boolean;
  markupPct: number;
  minPrice: number;
  maxWidthMm: number | null;
  maxHeightMm: number | null;
  allowSplit: boolean;
  sortOrder: number;
};

type RuntimeSiteStorformatM2Price = {
  materialId: string;
  fromM2: number;
  toM2: number | null;
  pricePerM2: number;
  isAnchor: boolean;
};

type RuntimeSiteStorformatFinish = {
  id: string;
  name: string;
  tags: string[];
  pricingMode: 'fixed' | 'per_m2';
  fixedPricePerUnit: number;
  interpolationEnabled: boolean;
  markupPct: number;
  sortOrder: number;
};

type RuntimeSiteStorformatFinishPrice = {
  finishId: string;
  pricingMode: 'fixed' | 'per_m2';
  fixedPrice: number;
  pricePerM2: number;
};

type RuntimeSiteStorformatProductItem = {
  id: string;
  name: string;
  pricingType: 'fixed' | 'per_item' | 'percentage' | 'm2';
  pricingMode: string;
  initialPrice: number;
  percentageMarkup: number;
  minPrice: number;
  interpolationEnabled: boolean;
  markupPct: number;
  sortOrder: number;
};

type RuntimeSiteStorformatProductFixedPrice = {
  productItemId: string;
  quantity: number;
  price: number;
};

type RuntimeSiteStorformatProductPriceTier = {
  productItemId: string;
  fromM2: number;
  toM2: number | null;
  pricePerM2: number;
  isAnchor: boolean;
};

type RuntimeSiteStorformatData = {
  config: RuntimeSiteStorformatConfig | null;
  materials: RuntimeSiteStorformatMaterial[];
  m2Prices: RuntimeSiteStorformatM2Price[];
  finishes: RuntimeSiteStorformatFinish[];
  finishPrices: RuntimeSiteStorformatFinishPrice[];
  productItems: RuntimeSiteStorformatProductItem[];
  productFixedPrices: RuntimeSiteStorformatProductFixedPrice[];
  productPriceTiers: RuntimeSiteStorformatProductPriceTier[];
};

type RuntimeSiteConfig = {
  siteId: string;
  tenantId: string;
  generatedAt: string;
  products: RuntimeSiteProduct[];
};

function runtimeConfigStorageKey(siteId: string, tenantId: string): string {
  return `wp_site_preview_runtime:${siteId}:${tenantId}`;
}

function withQueryParams(url: string, params: Record<string, string | null | undefined>): string {
  const hashIndex = url.indexOf('#');
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const parsed = new URL(base, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    parsed.searchParams.set(key, value);
  });

  return `${parsed.pathname}${parsed.search}${hash}`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePricingType(
  value: unknown,
): 'fixed' | 'per_item' | 'percentage' | 'm2' {
  const normalized = asString(value)?.toLowerCase() || '';
  if (normalized === 'per_item' || normalized === 'per-item') return 'per_item';
  if (normalized === 'percentage') return 'percentage';
  if (normalized === 'm2' || normalized === 'per_m2' || normalized === 'sqm') return 'm2';
  return 'fixed';
}

function normalizeFinishPricingMode(value: unknown): 'fixed' | 'per_m2' {
  const normalized = asString(value)?.toLowerCase() || '';
  if (normalized === 'per_m2' || normalized === 'm2' || normalized === 'per_m2_price') {
    return 'per_m2';
  }
  return 'fixed';
}

function readSiteButtonConfig(
  technicalSpecs: unknown,
  siteId: string,
): {
  buttonKey: string | null;
  buttonOrder: number | null;
  buttonLabel: string | null;
  buttonDescription: string | null;
  buttonImageUrl: string | null;
} {
  const specs = asObject(technicalSpecs);
  const siteFrontends = asObject(specs?.site_frontends);

  const globalButton = asObject(siteFrontends?.button);
  const siteButtons = asObject(siteFrontends?.buttons);
  const bySite = asObject(siteButtons?.[siteId]) || asObject(siteFrontends?.[siteId]);
  const merged = {
    ...(globalButton || {}),
    ...(bySite || {}),
  } as Record<string, unknown>;

  return {
    buttonKey: asString(merged.button_key ?? merged.buttonKey),
    buttonOrder: asNumber(merged.button_order ?? merged.buttonOrder),
    buttonLabel: asString(merged.button_label ?? merged.buttonLabel),
    buttonDescription: asString(merged.button_description ?? merged.buttonDescription),
    buttonImageUrl: asString(merged.button_image_url ?? merged.buttonImageUrl),
  };
}

function readSitePricingConfig(
  technicalSpecs: unknown,
  siteId: string,
): {
  activeFinishIds: string[];
  activeProductItemIds: string[];
} {
  const specs = asObject(technicalSpecs);
  const siteFrontends = asObject(specs?.site_frontends);
  const siteButtons = asObject(siteFrontends?.buttons);
  const bySite = asObject(siteButtons?.[siteId]) || asObject(siteFrontends?.[siteId]);
  const pricing = asObject(bySite?.pricing) || asObject(siteFrontends?.pricing);

  return {
    activeFinishIds: asStringArray(pricing?.active_finish_ids ?? pricing?.activeFinishIds),
    activeProductItemIds: asStringArray(
      pricing?.active_product_item_ids ?? pricing?.activeProductItemIds,
    ),
  };
}

function readDeliveryMethods(
  bannerConfig: unknown,
): RuntimeSiteDeliveryMethod[] {
  const fallbackMethods = cloneStandardDeliveryMethods();
  const fallbackById = new Map(
    fallbackMethods.map((method) => [String(method.id || '').toLowerCase(), method]),
  );
  const config = asObject(bannerConfig);
  const orderDelivery = asObject(config?.order_delivery);
  const delivery = asObject(orderDelivery?.delivery);
  const methods = delivery?.methods;
  if (!Array.isArray(methods)) return [];

  const normalized = methods
    .map((rawMethod, index) => {
      const method = asObject(rawMethod);
      if (!method) return null;
      const name = asString(method.name);
      if (!name) return null;
      const id = asString(method.id) || `delivery-${index + 1}`;
      const fallback = fallbackById.get(id.toLowerCase());
      return {
        id,
        name,
        description: asString(method.description) ?? fallback?.description ?? null,
        leadTimeDays: asNumber(method.lead_time_days) ?? fallback?.lead_time_days ?? null,
        cutoffTime:
          asString(method.cutoff_time ?? method.cutoffTime) ?? fallback?.cutoff_time ?? null,
        cutoffLabel:
          asString(method.cutoff_label ?? method.cutoffLabel) ?? fallback?.cutoff_label ?? null,
        submission: asString(method.submission),
        deliveryDate: asString(method.delivery_date ?? method.deliveryDate),
        price:
          asNumber(method.price)
          ?? fallback?.price
          ?? resolveDeliveryMethodCost(1, { id, price: null }),
      } as RuntimeSiteDeliveryMethod;
    })
    .filter((value): value is RuntimeSiteDeliveryMethod => !!value);

  const deduped = new Map<string, RuntimeSiteDeliveryMethod>();
  normalized.forEach((method) => {
    if (!deduped.has(method.id)) {
      deduped.set(method.id, method);
    }
  });
  return Array.from(deduped.values());
}

function hasTag(sitePackage: SitePackage, tag: string): boolean {
  return sitePackage.tags.some((value) => value.toLowerCase() === tag.toLowerCase());
}

function resolvePalette(sitePackage: SitePackage): PreviewPalette {
  if (hasTag(sitePackage, 'apparel') || hasTag(sitePackage, 'streetwear')) {
    return {
      bg: '#0B0B0E',
      bgSoft: '#15151B',
      text: '#F5F5F7',
      mutedText: '#B9BAC7',
      panel: '#161720',
      border: '#2A2B36',
      heroGradient: 'linear-gradient(135deg, #FF5E5B 0%, #8A4FFF 100%)',
      primary: '#FF5E5B',
      secondary: '#8A4FFF',
      heroImage: '/platform/slider/Tekstiltryk.png',
    };
  }

  if (
    hasTag(sitePackage, 'storformat') ||
    hasTag(sitePackage, 'banners') ||
    hasTag(sitePackage, 'facade') ||
    hasTag(sitePackage, 'signage')
  ) {
    return {
      bg: '#04131A',
      bgSoft: '#0A2029',
      text: '#EAF7FB',
      mutedText: '#9FC0CC',
      panel: '#0B2632',
      border: '#1C3B49',
      heroGradient: 'linear-gradient(135deg, #00B4D8 0%, #1B9AAA 45%, #30C67C 100%)',
      primary: '#00B4D8',
      secondary: '#30C67C',
      heroImage: '/images/banners/banner-storformat.jpg',
    };
  }

  if (hasTag(sitePackage, 'photo-products') || hasTag(sitePackage, 'posters') || hasTag(sitePackage, 'frames')) {
    return {
      bg: '#19130B',
      bgSoft: '#2A2115',
      text: '#FDF8F2',
      mutedText: '#D0C4B2',
      panel: '#2A2115',
      border: '#4A3B2A',
      heroGradient: 'linear-gradient(135deg, #FF9F1C 0%, #FF6B6B 100%)',
      primary: '#FF9F1C',
      secondary: '#FF6B6B',
      heroImage: '/hero-print.jpg',
    };
  }

  if (hasTag(sitePackage, 'education')) {
    return {
      bg: '#0A1230',
      bgSoft: '#121E4B',
      text: '#F2F5FF',
      mutedText: '#B4C0E8',
      panel: '#16255D',
      border: '#2A3E85',
      heroGradient: 'linear-gradient(135deg, #4D7CFE 0%, #12B981 100%)',
      primary: '#4D7CFE',
      secondary: '#12B981',
      heroImage: '/platform/slider/Skilteplancher.png',
    };
  }

  return {
    bg: '#0E1728',
    bgSoft: '#15223A',
    text: '#F5FAFF',
    mutedText: '#B2C2D8',
    panel: '#1A2C49',
    border: '#2D466D',
    heroGradient: 'linear-gradient(135deg, #3B82F6 0%, #14B8A6 100%)',
    primary: '#3B82F6',
    secondary: '#14B8A6',
    heroImage: '/images/banners/banner-professionelt-tryk.jpg',
  };
}

function productImageForName(name: string, index: number): string {
  const normalized = name.toLowerCase();

  if (normalized.includes('banner')) return '/images/products/bannere.png';
  if (normalized.includes('plakat') || normalized.includes('poster')) return '/images/products/plakater.png';
  if (normalized.includes('visitkort') || normalized.includes('card')) return '/images/products/visitkort.png';
  if (normalized.includes('flyer')) return '/images/products/flyers.png';
  if (normalized.includes('folder') || normalized.includes('fold')) return '/images/products/foldere.png';
  if (normalized.includes('folie') || normalized.includes('foil')) return '/images/products/folie.png';
  if (normalized.includes('sticker')) return '/images/products/klistermaerker.png';
  if (normalized.includes('skilt') || normalized.includes('sign')) return '/images/products/skilte.png';
  if (
    normalized.includes('tekstil') ||
    normalized.includes('tee') ||
    normalized.includes('t-shirt') ||
    normalized.includes('hoodie')
  ) {
    return '/images/products/tekstiltryk.svg';
  }

  const fallback = [
    '/images/products/flyers.png',
    '/images/products/plakater.png',
    '/images/products/bannere.png',
    '/images/products/skilte.png',
    '/images/products/visitkort.png',
    '/images/products/klistermaerker.png',
  ];

  return fallback[index % fallback.length];
}

function normalizeAssetPath(path?: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function previewPrice(name: string, index: number): number {
  const seed = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 49 + ((seed + index * 17) % 18) * 10;
}

export function SitePackagePreview({ siteId, tenantId }: SitePackagePreviewProps) {
  const sitePackage = SITE_PACKAGE_MAP[siteId];

  if (!sitePackage) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-slate-900">
        <Card className="max-w-xl w-full border-slate-700 bg-slate-800">
          <CardContent className="p-6 space-y-2">
            <h2 className="text-xl font-semibold text-slate-100">Site preview ikke fundet</h2>
            <p className="text-sm text-slate-300">
              Kunne ikke finde site-pakken. Gaa tilbage til `Sites` og vaelg et gyldigt site.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [manifest, setManifest] = useState<SitePreviewManifest | null>(null);
  const [manifestStatus, setManifestStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeSiteConfig | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadManifest = async () => {
      try {
        const response = await fetch(`/site-previews/${siteId}/manifest.json`, { cache: 'no-store' });
        if (!mounted) return;

        if (!response.ok) {
          setManifest(null);
          setManifestStatus('missing');
          return;
        }

        const data = (await response.json()) as SitePreviewManifest;
        setManifest(data);
        setManifestStatus('ready');
      } catch {
        if (!mounted) return;
        setManifest(null);
        setManifestStatus('error');
      }
    };

    setManifest(null);
    setManifestStatus('loading');
    loadManifest();

    return () => {
      mounted = false;
    };
  }, [siteId]);

  useEffect(() => {
    let active = true;

    const loadRuntimeConfig = async () => {
      if (!tenantId) {
        setRuntimeConfig(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select(
            'id, slug, name, description, icon_text, image_url, technical_specs, pricing_type, banner_config',
          )
          .eq('tenant_id', tenantId)
          .order('name', { ascending: true });

        if (error) throw error;
        if (!active) return;

        const rows = (data || []) as Array<{
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon_text: string | null;
          image_url: string | null;
          pricing_type?: string | null;
          technical_specs?: unknown;
          banner_config?: unknown;
        }>;

        const mapped = rows.filter((row) =>
          isProductAssignedToSite(row.technical_specs, siteId)
        );
        const legacyButtonMapped = rows.filter((row) => {
          const buttonConfig = readSiteButtonConfig(row.technical_specs, siteId);
          return (
            !!buttonConfig.buttonKey ||
            buttonConfig.buttonOrder !== null ||
            !!buttonConfig.buttonLabel ||
            !!buttonConfig.buttonDescription
          );
        });
        const sourceRows =
          mapped.length > 0
            ? mapped
            : legacyButtonMapped.length > 0
              ? legacyButtonMapped
              : siteId === "banner-builder-pro"
                ? []
                : rows;
        const sourceProductIds = sourceRows.map((row) => row.id).filter(Boolean);
        const storformatByProductId = new Map<string, RuntimeSiteStorformatData>();

        if (sourceProductIds.length > 0) {
          const readStorformatTable = async (
            table: string,
            orderBy?: string,
          ): Promise<Array<Record<string, unknown>>> => {
            let query = supabase
              .from(table as any)
              .select('*')
              .in('product_id', sourceProductIds);
            if (orderBy) {
              query = query.order(orderBy, { ascending: true });
            }
            const { data: tableRows, error: tableError } = await query;
            if (tableError) {
              console.warn(`[SitePackagePreview] Failed loading ${table}:`, tableError.message);
              return [];
            }
            return (tableRows || []) as Array<Record<string, unknown>>;
          };

          const [
            configRows,
            materialRows,
            m2PriceRows,
            finishRows,
            finishPriceRows,
            productRows,
            productFixedPriceRows,
            productPriceTierRows,
          ] = await Promise.all([
            readStorformatTable('storformat_configs'),
            readStorformatTable('storformat_materials', 'sort_order'),
            readStorformatTable('storformat_m2_prices', 'from_m2'),
            readStorformatTable('storformat_finishes', 'sort_order'),
            readStorformatTable('storformat_finish_prices'),
            readStorformatTable('storformat_products', 'sort_order'),
            readStorformatTable('storformat_product_fixed_prices', 'quantity'),
            readStorformatTable('storformat_product_price_tiers', 'from_m2'),
          ]);

          const groupByProductId = (
            rowsToGroup: Array<Record<string, unknown>>,
          ): Map<string, Array<Record<string, unknown>>> => {
            const grouped = new Map<string, Array<Record<string, unknown>>>();
            rowsToGroup.forEach((row) => {
              const productId = asString(row.product_id);
              if (!productId) return;
              const current = grouped.get(productId) || [];
              current.push(row);
              grouped.set(productId, current);
            });
            return grouped;
          };

          const configByProductId = new Map<string, Record<string, unknown>>();
          configRows.forEach((row) => {
            const productId = asString(row.product_id);
            if (!productId || configByProductId.has(productId)) return;
            configByProductId.set(productId, row);
          });

          const materialsByProductId = groupByProductId(materialRows);
          const m2PricesByProductId = groupByProductId(m2PriceRows);
          const finishesByProductId = groupByProductId(finishRows);
          const finishPricesByProductId = groupByProductId(finishPriceRows);
          const productItemsByProductId = groupByProductId(productRows);
          const productFixedPricesByProductId = groupByProductId(productFixedPriceRows);
          const productPriceTiersByProductId = groupByProductId(productPriceTierRows);

          sourceProductIds.forEach((productId) => {
            const configRow = configByProductId.get(productId) || null;
            const config: RuntimeSiteStorformatConfig | null = configRow
              ? {
                roundingStep: asNumber(configRow.rounding_step) ?? 1,
                globalMarkupPct: asNumber(configRow.global_markup_pct) ?? 0,
                quantities: Array.isArray(configRow.quantities)
                  ? configRow.quantities
                    .map((value) => asNumber(value))
                    .filter((value): value is number => value !== null && value > 0)
                  : [1],
              }
              : null;

            const materials: RuntimeSiteStorformatMaterial[] = (
              materialsByProductId.get(productId) || []
            )
              .map((row) => {
                const id = asString(row.id);
                const name = asString(row.name);
                if (!id || !name) return null;
                return {
                  id,
                  name,
                  interpolationEnabled: asBoolean(row.interpolation_enabled, true),
                  markupPct: asNumber(row.markup_pct) ?? 0,
                  minPrice: asNumber((row as any).min_price) ?? 0,
                  maxWidthMm: asNumber(row.max_width_mm),
                  maxHeightMm: asNumber(row.max_height_mm),
                  allowSplit: asBoolean(row.allow_split, true),
                  sortOrder: asNumber(row.sort_order) ?? 0,
                };
              })
              .filter((value): value is RuntimeSiteStorformatMaterial => !!value);

            const m2Prices: RuntimeSiteStorformatM2Price[] = (
              m2PricesByProductId.get(productId) || []
            )
              .map((row) => {
                const materialId = asString(row.material_id);
                const fromM2 = asNumber(row.from_m2);
                const pricePerM2 = asNumber(row.price_per_m2);
                if (!materialId || fromM2 === null || pricePerM2 === null) return null;
                return {
                  materialId,
                  fromM2,
                  toM2: asNumber(row.to_m2),
                  pricePerM2,
                  isAnchor: asBoolean(row.is_anchor, false),
                };
              })
              .filter((value): value is RuntimeSiteStorformatM2Price => !!value);

            const finishes: RuntimeSiteStorformatFinish[] = (
              finishesByProductId.get(productId) || []
            )
              .map((row) => {
                const id = asString(row.id);
                const name = asString(row.name);
                if (!id || !name) return null;
                return {
                  id,
                  name,
                  tags: asStringArray((row as any).tags),
                  pricingMode: normalizeFinishPricingMode(row.pricing_mode),
                  fixedPricePerUnit: asNumber(row.fixed_price_per_unit) ?? 0,
                  interpolationEnabled: asBoolean(row.interpolation_enabled, true),
                  markupPct: asNumber(row.markup_pct) ?? 0,
                  sortOrder: asNumber(row.sort_order) ?? 0,
                };
              })
              .filter((value): value is RuntimeSiteStorformatFinish => !!value);

            const finishPrices: RuntimeSiteStorformatFinishPrice[] = (
              finishPricesByProductId.get(productId) || []
            )
              .map((row) => {
                const finishId = asString(row.finish_id);
                if (!finishId) return null;
                return {
                  finishId,
                  pricingMode: normalizeFinishPricingMode(row.pricing_mode),
                  fixedPrice: asNumber(row.fixed_price) ?? 0,
                  pricePerM2: asNumber(row.price_per_m2) ?? 0,
                };
              })
              .filter((value): value is RuntimeSiteStorformatFinishPrice => !!value);

            const productItems: RuntimeSiteStorformatProductItem[] = (
              productItemsByProductId.get(productId) || []
            )
              .map((row) => {
                const id = asString(row.id);
                const name = asString(row.name);
                if (!id || !name) return null;
                return {
                  id,
                  name,
                  pricingType: normalizePricingType((row as any).pricing_type || row.pricing_mode),
                  pricingMode: asString(row.pricing_mode) || 'fixed',
                  initialPrice: asNumber(row.initial_price) ?? 0,
                  percentageMarkup: asNumber((row as any).percentage_markup) ?? 0,
                  minPrice: asNumber((row as any).min_price) ?? 0,
                  interpolationEnabled: asBoolean(row.interpolation_enabled, true),
                  markupPct: asNumber(row.markup_pct) ?? 0,
                  sortOrder: asNumber(row.sort_order) ?? 0,
                };
              })
              .filter((value): value is RuntimeSiteStorformatProductItem => !!value);

            const productFixedPrices: RuntimeSiteStorformatProductFixedPrice[] = (
              productFixedPricesByProductId.get(productId) || []
            )
              .map((row) => {
                const productItemId = asString((row as any).product_item_id || (row as any).storformat_product_id);
                const quantity = asNumber(row.quantity);
                const price = asNumber(row.price);
                if (!productItemId || quantity === null || price === null) return null;
                return {
                  productItemId,
                  quantity,
                  price,
                };
              })
              .filter((value): value is RuntimeSiteStorformatProductFixedPrice => !!value);

            const productPriceTiers: RuntimeSiteStorformatProductPriceTier[] = (
              productPriceTiersByProductId.get(productId) || []
            )
              .map((row) => {
                const productItemId = asString((row as any).product_item_id || (row as any).storformat_product_id);
                const fromM2 = asNumber(row.from_m2);
                const pricePerM2 = asNumber(row.price_per_m2);
                if (!productItemId || fromM2 === null || pricePerM2 === null) return null;
                return {
                  productItemId,
                  fromM2,
                  toM2: asNumber(row.to_m2),
                  pricePerM2,
                  isAnchor: asBoolean(row.is_anchor, false),
                };
              })
              .filter((value): value is RuntimeSiteStorformatProductPriceTier => !!value);

            storformatByProductId.set(productId, {
              config,
              materials,
              m2Prices,
              finishes,
              finishPrices,
              productItems,
              productFixedPrices,
              productPriceTiers,
            });
          });
        }

        const products = sourceRows.map((row) => {
          const buttonConfig = readSiteButtonConfig(row.technical_specs, siteId);
          const sitePricingConfig = readSitePricingConfig(row.technical_specs, siteId);
          const deliveryMethods = readDeliveryMethods(row.banner_config);
          return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            pricingType: row.pricing_type || null,
            description: row.description,
            iconText: row.icon_text,
            imageUrl: row.image_url,
            buttonKey: buttonConfig.buttonKey,
            buttonOrder: buttonConfig.buttonOrder,
            buttonLabel: buttonConfig.buttonLabel,
            buttonDescription: buttonConfig.buttonDescription,
            buttonImageUrl: buttonConfig.buttonImageUrl,
            activeFinishIds: sitePricingConfig.activeFinishIds,
            activeProductItemIds: sitePricingConfig.activeProductItemIds,
            deliveryMethods,
            storformat: storformatByProductId.get(row.id) || null,
          };
        });

        const nextConfig: RuntimeSiteConfig = {
          siteId,
          tenantId,
          generatedAt: new Date().toISOString(),
          products,
        };

        const storageKey = runtimeConfigStorageKey(siteId, tenantId);
        sessionStorage.setItem(storageKey, JSON.stringify(nextConfig));
        setRuntimeConfig(nextConfig);
      } catch {
        if (!active) return;
        setRuntimeConfig(null);
      }
    };

    loadRuntimeConfig();
    const refreshTimer = window.setInterval(loadRuntimeConfig, 15000);
    const onFocus = () => {
      loadRuntimeConfig();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [siteId, tenantId]);

  const palette = useMemo(
    () => ({
      ...resolvePalette(sitePackage),
      ...(manifest?.palette || {}),
    }),
    [sitePackage, manifest]
  );
  const products = sitePackage.seedLibraryItems.filter((item) => item.templateType === 'product');
  const finishes = sitePackage.seedLibraryItems.filter((item) => item.templateType === 'finish');
  const materials = sitePackage.seedLibraryItems.filter((item) => item.templateType === 'material');
  const formats = sitePackage.seedFormats;

  const manifestHeroImage = normalizeAssetPath(manifest?.heroImage);
  const heroImage = manifestHeroImage || palette.heroImage;
  const galleryImages = (manifest?.galleryImages || []).map(normalizeAssetPath).filter(Boolean) as string[];
  const entryPath = normalizeAssetPath(manifest?.entry);
  const runtimeStorageKey =
    runtimeConfig && runtimeConfig.tenantId
      ? runtimeConfigStorageKey(siteId, runtimeConfig.tenantId)
      : null;
  const iframeEntryPath = entryPath
    ? withQueryParams(entryPath, {
      wpPreviewConfigKey: runtimeStorageKey,
      wpSiteId: siteId,
      tenantId: tenantId || null,
    })
    : null;

  const visualProducts =
    products.length > 0
      ? products.slice(0, 8)
      : [
        { id: `${sitePackage.id}-starter-1`, name: 'Starter Produkt', templateType: 'product' as const },
        { id: `${sitePackage.id}-starter-2`, name: 'Featured Produkt', templateType: 'product' as const },
        { id: `${sitePackage.id}-starter-3`, name: 'Premium Produkt', templateType: 'product' as const },
        { id: `${sitePackage.id}-starter-4`, name: 'Custom Produkt', templateType: 'product' as const },
      ];

  if (manifest?.mode === 'iframe' && iframeEntryPath) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Sites Preview</p>
              <p className="text-sm font-semibold">{sitePackage.name} (repo bundle)</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <a href={iframeEntryPath} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Aabn bundle
                </a>
              </Button>
              <Button asChild>
                <a href={sitePackage.repoUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        </header>
        <main className="h-[calc(100vh-73px)]">
          <iframe
            title={`${sitePackage.name} preview`}
            src={iframeEntryPath}
            className="w-full h-full border-0 bg-white"
            loading="lazy"
          />
        </main>
      </div>
    );
  }

  const resolvePreviewProductImage = (name: string, index: number) => {
    if (galleryImages.length > 0) {
      return galleryImages[index % galleryImages.length];
    }
    return productImageForName(name, index);
  };

  const heroHeadline = manifest?.headline || `${sitePackage.name} visual storefront preview`;
  const heroSubline =
    manifest?.subline ||
    'Dette er en visuel mock af site-pakken i WebPrinter. Produktvalg, formater og efterbehandlinger er koblet til samme backend og checkout-flow.';

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        fontFamily: 'Poppins, system-ui, sans-serif',
      }}
    >
      <header className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: palette.border, backgroundColor: `${palette.bg}DD` }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: palette.heroGradient, color: '#FFFFFF' }}
            >
              {sitePackage.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: palette.mutedText }}>
                Sites Preview
              </p>
              <p className="text-sm font-semibold truncate">{sitePackage.name}</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-5 text-sm" style={{ color: palette.mutedText }}>
            <span>Produkter</span>
            <span>Formater</span>
            <span>Efterbehandling</span>
            <span>Checkout</span>
            <Badge
              className="border text-[10px]"
              style={{
                backgroundColor: manifestStatus === 'ready' ? '#14532D' : palette.bgSoft,
                borderColor: manifestStatus === 'ready' ? '#22C55E' : palette.border,
                color: manifestStatus === 'ready' ? '#DCFCE7' : palette.mutedText,
              }}
            >
              {manifestStatus === 'ready' ? 'Repo assets loaded' : 'Mock assets'}
            </Badge>
          </div>

          <Button
            asChild
            className="border-0"
            style={{ background: palette.primary, color: '#FFFFFF' }}
          >
            <a href={sitePackage.repoUrl} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="h-4 w-4 mr-2" />
              GitHub
            </a>
          </Button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-8">
        <div
          className="rounded-3xl overflow-hidden border p-6 md:p-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8"
          style={{
            borderColor: palette.border,
            background: palette.heroGradient,
          }}
        >
          <div className="space-y-5">
            <Badge className="text-xs px-3 py-1 bg-white/15 text-white border-transparent">
              {manifestStatus === 'ready' ? 'Repo visual bundle' : 'Fallback mock preview'}
            </Badge>
            <h1 className="text-3xl md:text-5xl font-semibold leading-tight">{heroHeadline}</h1>
            <p className="text-sm md:text-base max-w-2xl text-white/90">
              {heroSubline}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-white text-slate-900 hover:bg-white/90">
                <Sparkles className="h-4 w-4 mr-2" />
                Start design
              </Button>
              <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                Se produkter
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/25 bg-white/10">
            <img
              src={heroImage}
              alt={`${sitePackage.name} hero`}
              className="w-full h-full min-h-[220px] object-cover"
            />
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pb-16 space-y-10">
        {manifestStatus !== 'ready' && (
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-4 text-sm" style={{ color: palette.mutedText }}>
              Repo preview bundle ikke fundet. Tilfoej `public/site-previews/{siteId}/manifest.json`
              med repo assets (eller `mode: iframe` + `entry`) for at vise det originale site-design.
            </CardContent>
          </Card>
        )}

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-4">
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Produkter
              </p>
              <p className="text-2xl font-semibold">{products.length}</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-4">
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Formater
              </p>
              <p className="text-2xl font-semibold">{formats.length}</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-4">
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Efterbehandling
              </p>
              <p className="text-2xl font-semibold">{finishes.length}</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-4">
              <p className="text-xs" style={{ color: palette.mutedText }}>
                Materialer
              </p>
              <p className="text-2xl font-semibold">{materials.length}</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-semibold">Populaere produkter</h2>
            <p className="text-sm" style={{ color: palette.mutedText }}>
              Preview af den valgte site facade
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visualProducts.map((product, index) => (
              <Card
                key={product.id}
                className="overflow-hidden transition-transform duration-200 hover:-translate-y-1"
                style={{ backgroundColor: palette.panel, borderColor: palette.border }}
              >
                <div className="aspect-[4/3] bg-black/15">
                  <img
                    src={resolvePreviewProductImage(product.name, index)}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-4">
                  <p className="text-sm font-semibold truncate">{product.name}</p>
                  <p className="text-xs mt-1" style={{ color: palette.mutedText }}>
                    Fra DKK {previewPrice(product.name, index)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                Format presets
              </h3>
              {formats.length === 0 ? (
                <p className="text-sm" style={{ color: palette.mutedText }}>
                  Ingen formater defineret endnu for denne pakke.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {formats.slice(0, 8).map((format) => (
                    <div
                      key={format.id}
                      className="rounded-lg border px-3 py-2"
                      style={{ borderColor: palette.border, backgroundColor: palette.bgSoft }}
                    >
                      <p className="text-sm font-medium">{format.name}</p>
                      <p className="text-xs mt-1" style={{ color: palette.mutedText }}>
                        {format.widthMm} x {format.heightMm} mm
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
            <CardContent className="p-5 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Materialer og finish
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide mb-2" style={{ color: palette.mutedText }}>
                    Efterbehandling
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {finishes.length === 0 ? (
                      <span className="text-sm" style={{ color: palette.mutedText }}>
                        Ingen endnu
                      </span>
                    ) : (
                      finishes.slice(0, 10).map((finish) => (
                        <Badge
                          key={finish.id}
                          className="border"
                          style={{ backgroundColor: palette.bgSoft, borderColor: palette.border, color: palette.text }}
                        >
                          {finish.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide mb-2" style={{ color: palette.mutedText }}>
                    Materialer
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {materials.length === 0 ? (
                      <span className="text-sm" style={{ color: palette.mutedText }}>
                        Ingen endnu
                      </span>
                    ) : (
                      materials.slice(0, 10).map((material) => (
                        <Badge
                          key={material.id}
                          className="border"
                          style={{ backgroundColor: palette.bgSoft, borderColor: palette.border, color: palette.text }}
                        >
                          {material.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card style={{ backgroundColor: palette.panel, borderColor: palette.border }}>
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Shared checkout flow
            </h3>
            <p className="text-sm mt-2" style={{ color: palette.mutedText }}>
              Kunden vaelger produkt og konfiguration i dette site UI, og checkout koerer i WebPrinter backend.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="border" style={{ backgroundColor: palette.bgSoft, borderColor: palette.border, color: palette.text }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Shared products
              </Badge>
              <Badge className="border" style={{ backgroundColor: palette.bgSoft, borderColor: palette.border, color: palette.text }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Shared pricing
              </Badge>
              <Badge className="border" style={{ backgroundColor: palette.bgSoft, borderColor: palette.border, color: palette.text }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Shared checkout
              </Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
