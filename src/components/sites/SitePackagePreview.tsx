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

interface SitePackagePreviewProps {
  siteId: string;
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

export function SitePackagePreview({ siteId }: SitePackagePreviewProps) {
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

  const visualProducts =
    products.length > 0
      ? products.slice(0, 8)
      : [
          { id: `${sitePackage.id}-starter-1`, name: 'Starter Produkt', templateType: 'product' as const },
          { id: `${sitePackage.id}-starter-2`, name: 'Featured Produkt', templateType: 'product' as const },
          { id: `${sitePackage.id}-starter-3`, name: 'Premium Produkt', templateType: 'product' as const },
          { id: `${sitePackage.id}-starter-4`, name: 'Custom Produkt', templateType: 'product' as const },
        ];

  if (manifest?.mode === 'iframe' && entryPath) {
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
                <a href={entryPath} target="_blank" rel="noreferrer noopener">
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
            src={entryPath}
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
