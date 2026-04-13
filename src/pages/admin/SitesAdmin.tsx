import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  Loader2,
  Store,
  PackagePlus,
  CheckCircle2,
  Palette,
  LayoutGrid,
  Layers3,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant, MASTER_TENANT_ID } from '@/lib/adminTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SITE_PACKAGES, SITE_PACKAGE_MAP, type SitePackage } from '@/lib/sites/sitePackages';
import { buildPreviewShopUrl } from '@/lib/preview/previewSession';
import {
  installSitePackageTemplates,
  type SiteInstallSummary,
} from '@/lib/sites/installSitePackage';
import { readProductSiteIds } from '@/lib/sites/productSiteFrontends';

type TenantData = {
  id: string;
  name: string;
  settings: any;
  domain?: string | null;
};

type SiteFrontendState = {
  activeSiteId: string | null;
  installedSiteIds: string[];
  lastInstallBySite: Record<string, SiteInstallSummary & { installedAt: string }>;
};

function parseSiteFrontendState(settings: any): SiteFrontendState {
  const root = settings?.site_frontends || {};

  return {
    activeSiteId: typeof root.activeSiteId === 'string' ? root.activeSiteId : null,
    installedSiteIds: Array.isArray(root.installedSiteIds)
      ? root.installedSiteIds.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    lastInstallBySite:
      root.lastInstallBySite && typeof root.lastInstallBySite === 'object'
        ? root.lastInstallBySite
        : {},
  };
}

function mergeSiteFrontendState(settings: any, patch: Partial<SiteFrontendState>) {
  const current = parseSiteFrontendState(settings);
  const currentRaw = settings?.site_frontends || {};

  return {
    ...(settings || {}),
    site_frontends: {
      ...currentRaw,
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

function formatInstallSummary(summary?: SiteInstallSummary) {
  if (!summary) return 'Ikke installeret endnu';

  return `${summary.inserted} oprettet, ${summary.skipped} allerede eksisterede`;
}

function countByType(sitePackage: SitePackage) {
  return {
    formats: sitePackage.seedFormats.length,
    materials: sitePackage.seedLibraryItems.filter((item) => item.templateType === 'material').length,
    finishes: sitePackage.seedLibraryItems.filter((item) => item.templateType === 'finish').length,
    products: sitePackage.seedLibraryItems.filter((item) => item.templateType === 'product').length,
  };
}

export default function SitesAdmin() {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingSiteId, setWorkingSiteId] = useState<string | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [mappedProductCounts, setMappedProductCounts] = useState<Record<string, number>>({});
  const [mappingStatsLoading, setMappingStatsLoading] = useState(false);
  const [launchSiteId, setLaunchSiteId] = useState<string | null>(null);
  const rootDomain = import.meta.env.VITE_ROOT_DOMAIN || 'webprinter.dk';
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

  const siteState = useMemo(() => parseSiteFrontendState(tenant?.settings), [tenant?.settings]);

  const activeSite = siteState.activeSiteId ? SITE_PACKAGE_MAP[siteState.activeSiteId] : undefined;
  const runtimeLiveHost = !isLocalhost && currentHostname ? currentHostname : null;
  const liveHost = tenant?.domain
    ? tenant.domain
    : runtimeLiveHost || (tenant?.id === MASTER_TENANT_ID ? rootDomain : null);
  const liveUrl = liveHost
    ? `https://${liveHost}`
    : null;
  const liveAddressLabel = liveHost;
  const hasCustomDomain = Boolean(tenant?.domain);
  const activeSiteMappedCount = activeSite ? mappedProductCounts[activeSite.id] ?? 0 : 0;
  const activeSiteInstalled = activeSite ? siteState.installedSiteIds.includes(activeSite.id) : false;
  const activeSiteLaunchReady = Boolean(activeSite && activeSiteInstalled && activeSiteMappedCount > 0 && liveUrl);
  const launchSite = launchSiteId ? SITE_PACKAGE_MAP[launchSiteId] : undefined;

  const persistSettings = async (nextSettings: any) => {
    if (!tenant) return;
    if (!isMasterAdmin) {
      throw new Error('Sites administreres centralt af master-tenant.');
    }

    const { error } = await supabase
      .from('tenants' as any)
      .update({ settings: nextSettings })
      .eq('id', tenant.id);

    if (error) throw error;

    setTenant((current) =>
      current
        ? {
            ...current,
            settings: nextSettings,
          }
        : current
    );
  };

  const refreshTenant = async () => {
    setLoading(true);

    try {
      const { tenantId, isMasterAdmin: resolvedIsMasterAdmin } = await resolveAdminTenant();
      setIsMasterAdmin(resolvedIsMasterAdmin);

      const targetTenantId = resolvedIsMasterAdmin ? MASTER_TENANT_ID : tenantId;
      if (!targetTenantId) {
        setTenant(null);
        return;
      }

      const { data, error } = await supabase
        .from('tenants' as any)
        .select('id, name, settings, domain')
        .eq('id', targetTenantId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setTenant(null);
        return;
      }

      setTenant(data as TenantData);
    } catch (error: any) {
      console.error('Failed to load tenant for Sites:', error);
      toast.error('Kunne ikke hente Sites-indstillinger');
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTenant();
  }, []);

  useEffect(() => {
    let isActive = true;

    const refreshMappedProducts = async () => {
      if (!tenant?.id) {
        if (isActive) setMappedProductCounts({});
        return;
      }

      setMappingStatsLoading(true);

      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, technical_specs')
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        const nextCounts = Object.fromEntries(SITE_PACKAGES.map((site) => [site.id, 0]));

        (data || []).forEach((product: { technical_specs?: unknown }) => {
          readProductSiteIds(product.technical_specs).forEach((siteId) => {
            if (Object.prototype.hasOwnProperty.call(nextCounts, siteId)) {
              nextCounts[siteId] += 1;
            }
          });
        });

        if (isActive) {
          setMappedProductCounts(nextCounts);
        }
      } catch (error) {
        console.error('Failed to load site product mappings:', error);
        if (isActive) {
          setMappedProductCounts({});
        }
      } finally {
        if (isActive) {
          setMappingStatsLoading(false);
        }
      }
    };

    refreshMappedProducts();

    return () => {
      isActive = false;
    };
  }, [tenant?.id]);

  const getPreviewHref = (siteId: string) => {
    if (!tenant) return '/preview-shop';
    return buildPreviewShopUrl({
      tenantId: tenant.id,
      siteId,
      sitePreviewMode: true,
      page: '/',
    });
  };

  const getSiteLaunchState = (sitePackage: SitePackage) => {
    const isInstalled = siteState.installedSiteIds.includes(sitePackage.id);
    const mappedProducts = mappedProductCounts[sitePackage.id] ?? 0;
    const issues: string[] = [];

    if (!isInstalled) issues.push('Biblioteket er ikke installeret endnu');
    if (mappedProducts === 0) issues.push('Der er endnu ikke tilknyttet produkter til dette site');
    if (!liveUrl) issues.push('Shoppen mangler live adresse eller domæne');

    return {
      isInstalled,
      mappedProducts,
      isReady: isInstalled && mappedProducts > 0 && Boolean(liveUrl),
      issues,
    };
  };

  const handleActivateSite = async (sitePackage: SitePackage) => {
    if (!tenant) return;
    if (!isMasterAdmin) {
      toast.error('Sites styres af master-tenant og kan ikke aktiveres her.');
      return;
    }

    setWorkingSiteId(sitePackage.id);
    try {
      const nextSettings = mergeSiteFrontendState(tenant.settings, {
        activeSiteId: sitePackage.id,
      });
      await persistSettings(nextSettings);
      toast.success(`${sitePackage.name} er nu aktiv i Sites`);
    } catch (error: any) {
      console.error('Failed to activate site package:', error);
      toast.error(error?.message || 'Kunne ikke aktivere site');
    } finally {
      setWorkingSiteId(null);
    }
  };

  const handleGoLive = async (sitePackage: SitePackage) => {
    if (!tenant) return;
    if (!isMasterAdmin) {
      toast.error('Sites styres af master-tenant og kan ikke gøres live her.');
      return;
    }

    const launchState = getSiteLaunchState(sitePackage);
    if (!launchState.isReady) {
      toast.error(launchState.issues[0] || 'Site er ikke klar til live endnu.');
      return;
    }

    setWorkingSiteId(sitePackage.id);
    try {
      const nextSettings = mergeSiteFrontendState(tenant.settings, {
        activeSiteId: sitePackage.id,
      });
      await persistSettings(nextSettings);
      setLaunchSiteId(null);
      toast.success(
        liveUrl
          ? `${sitePackage.name} er nu live på ${liveAddressLabel}`
          : `${sitePackage.name} er nu gjort live`
      );
    } catch (error: any) {
      console.error('Failed to launch site package:', error);
      toast.error(error?.message || 'Kunne ikke gøre site live');
    } finally {
      setWorkingSiteId(null);
    }
  };

  const handleInstallSite = async (sitePackage: SitePackage) => {
    if (!tenant) return;
    if (!isMasterAdmin) {
      toast.error('Sites styres af master-tenant og kan ikke installeres her.');
      return;
    }

    setWorkingSiteId(sitePackage.id);

    try {
      const summary = await installSitePackageTemplates({
        sitePackage,
        tenantId: tenant.id,
      });

      const installedSiteIds = Array.from(new Set([...siteState.installedSiteIds, sitePackage.id]));
      const lastInstallBySite = {
        ...siteState.lastInstallBySite,
        [sitePackage.id]: {
          ...summary,
          installedAt: new Date().toISOString(),
        },
      };

      const nextSettings = mergeSiteFrontendState(tenant.settings, {
        installedSiteIds,
        activeSiteId: siteState.activeSiteId || sitePackage.id,
        lastInstallBySite,
      });

      await persistSettings(nextSettings);

      toast.success(
        `${sitePackage.name}: ${summary.inserted} nye bibliotekselementer installeret`
      );
    } catch (error: any) {
      console.error('Failed to install site package:', error);
      toast.error(error?.message || 'Kunne ikke installere site-pakke');
    } finally {
      setWorkingSiteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>Der kunne ikke findes en aktiv shop-kontekst.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Sites
          </CardTitle>
          <CardDescription>
            Vaelg et facade-site, importer site-specifikke formater/efterbehandlinger til biblioteket,
            og behold checkout i WebPrinter-systemet.
          </CardDescription>
          <p className="text-xs text-muted-foreground px-6 pb-2">
            For 1:1 repo-visual preview: add bundle manifest in
            <code className="ml-1">public/site-previews/&lt;site-id&gt;/manifest.json</code>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isMasterAdmin && (
            <div className="rounded-md border border-amber-300/70 bg-amber-100/50 px-3 py-2 text-xs text-amber-900">
              Site-pakker er midlertidigt master-styrede. Du kan previewe dem her, men aktivering/installering er låst for tenant-konti.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Aktiv shop:</span>
            <Badge variant="secondary">{tenant.name}</Badge>
            {activeSite ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Aktivt site: {activeSite.name}
              </Badge>
            ) : (
              <Badge variant="outline">Intet site valgt endnu</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/branding-v2">
                <Palette className="h-4 w-4 mr-2" />
                Gaa til Site Design
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/site-design-v2">
                <Palette className="h-4 w-4 mr-2" />
                Gaa til Site Design V2
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/tilvalgsbibliotek">
                <Layers3 className="h-4 w-4 mr-2" />
                Aabn tilvalgsbibliotek
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/products">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Gaa til produkter
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/domaene">
                <Globe className="h-4 w-4 mr-2" />
                Domæne & DNS
              </Link>
            </Button>
            {activeSite && liveUrl && (
              <Button asChild size="sm">
                <a href={liveUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Åbn live site
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Go Live-status
          </CardTitle>
          <CardDescription>
            Samlet status for aktivt facade-site: valgt site, produkt-tilknytning og live adresse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Aktivt site</div>
              {activeSite ? (
                <>
                  <div className="font-medium">{activeSite.name}</div>
                  <Badge className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Valgt
                  </Badge>
                </>
              ) : (
                <>
                  <div className="font-medium">Intet valgt</div>
                  <Badge variant="outline">Mangler</Badge>
                </>
              )}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Bibliotek</div>
              <div className="font-medium">
                {activeSiteInstalled ? 'Installeret for aktivt site' : 'Ikke installeret endnu'}
              </div>
              <Badge variant={activeSiteInstalled ? 'secondary' : 'outline'}>
                {activeSiteInstalled ? 'Klar' : 'Mangler'}
              </Badge>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Produkter tilknyttet</div>
              <div className="font-medium">
                {mappingStatsLoading ? 'Henter…' : `${activeSiteMappedCount} produkter`}
              </div>
              <Badge variant={activeSiteMappedCount > 0 ? 'secondary' : 'outline'}>
                {activeSiteMappedCount > 0 ? 'Klar' : 'Mangler'}
              </Badge>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Live adresse</div>
              <div className="font-medium break-all">
                {liveAddressLabel || 'Ingen live adresse endnu'}
              </div>
              <Badge variant={liveUrl ? 'secondary' : 'outline'}>
                {hasCustomDomain ? 'Eget domæne' : liveUrl ? 'WebPrinter-subdomæne' : 'Mangler'}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Launch-status:</span>
              {activeSiteLaunchReady ? (
                <Badge className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Klar til live
                </Badge>
              ) : (
                <Badge variant="outline">Ikke klar endnu</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Et site er klar til live, når et facade-site er aktivt, biblioteket er installeret,
              mindst ét produkt er tilknyttet, og shoppen har en live adresse.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {SITE_PACKAGES.map((sitePackage) => {
          const isInstalled = siteState.installedSiteIds.includes(sitePackage.id);
          const isActive = siteState.activeSiteId === sitePackage.id;
          const counts = countByType(sitePackage);
          const lastInstall = siteState.lastInstallBySite[sitePackage.id];
          const isWorking = workingSiteId === sitePackage.id;
          const launchState = getSiteLaunchState(sitePackage);
          const mappedProducts = launchState.mappedProducts;
          const launchReady = launchState.isReady;

          return (
            <Card key={sitePackage.id} className={isActive ? 'border-primary' : undefined}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{sitePackage.name}</CardTitle>
                    <CardDescription className="mt-1">{sitePackage.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {isActive && <Badge>Aktiv</Badge>}
                    {isInstalled && <Badge variant="secondary">Installeret</Badge>}
                    {!isInstalled && <Badge variant="outline">Ikke installeret</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {sitePackage.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>Formater: {counts.formats}</span>
                  <span>Materialer: {counts.materials}</span>
                  <span>Efterbehandling: {counts.finishes}</span>
                  <span>Produkter: {counts.products}</span>
                </div>

                <Separator />

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{formatInstallSummary(lastInstall)}</p>
                  {lastInstall?.installedAt && (
                    <p>Sidst installeret: {new Date(lastInstall.installedAt).toLocaleString('da-DK')}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border px-3 py-2 space-y-1">
                    <div className="text-muted-foreground">Produkter tilknyttet</div>
                    <div className="font-medium">{mappingStatsLoading ? 'Henter…' : mappedProducts}</div>
                  </div>
                  <div className="rounded-md border px-3 py-2 space-y-1">
                    <div className="text-muted-foreground">Launch-status</div>
                    <div className="font-medium">
                      {isActive
                        ? launchReady
                          ? 'Klar til live'
                          : 'Mangler opsætning'
                        : launchReady
                          ? 'Kan gøres live'
                          : 'Ikke klar endnu'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isWorking || !isMasterAdmin}
                    onClick={() => handleActivateSite(sitePackage)}
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Aktivér site
                  </Button>

                  <Button
                    size="sm"
                    variant={isActive ? 'secondary' : 'default'}
                    disabled={isWorking || !isMasterAdmin || !launchReady}
                    onClick={() => setLaunchSiteId(sitePackage.id)}
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Gør live
                  </Button>

                  <Button size="sm" variant="secondary" asChild>
                    <a
                      href={getPreviewHref(sitePackage.id)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Preview
                    </a>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      isWorking ||
                      !isMasterAdmin ||
                      (counts.formats + counts.materials + counts.finishes + counts.products === 0)
                    }
                    onClick={() => handleInstallSite(sitePackage)}
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PackagePlus className="h-4 w-4 mr-2" />
                    )}
                    Installer bibliotek
                  </Button>

                  <Button size="sm" variant="ghost" asChild>
                    <a href={sitePackage.repoUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub
                    </a>
                  </Button>

                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/admin/domaene">
                      <Globe className="h-4 w-4 mr-2" />
                      Domæne & DNS
                    </Link>
                  </Button>

                  {isActive && liveUrl && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={liveUrl} target="_blank" rel="noreferrer noopener">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Åbn live site
                      </a>
                    </Button>
                  )}
                </div>

                <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Aktivér site:</span>{' '}
                    Vælger hvilket facade-site der er aktivt som kontekst i preview/admin.
                    Dette importerer ikke bibliotekselementer.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Installer bibliotek:</span>{' '}
                    Importerer site-specifikke formater, materialer, efterbehandlinger og produkter til biblioteket.
                    Kan køres igen sikkert, eksisterende elementer springes over.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Go Live:</span>{' '}
                    Kræver aktivt site, mindst ét tilknyttet produkt og en live adresse. Brug
                    <span className="mx-1">Site-tilknytning</span>på produkter for at få dem ind i facade-sitet.
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={Boolean(launchSite)} onOpenChange={(open) => !open && setLaunchSiteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gør site live?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette gør det valgte facade-site til den aktive live shop på den tilknyttede adresse.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {launchSite && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm space-y-2">
                <div className="font-medium">{launchSite.name}</div>
                <div className="text-muted-foreground">
                  Live adresse: {liveAddressLabel || 'Ingen live adresse endnu'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Bibliotek</div>
                  <div className="mt-1 font-medium">
                    {getSiteLaunchState(launchSite).isInstalled ? 'Klar' : 'Mangler'}
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Produkter</div>
                  <div className="mt-1 font-medium">
                    {getSiteLaunchState(launchSite).mappedProducts} tilknyttet
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Domæne</div>
                  <div className="mt-1 font-medium">
                    {liveUrl ? 'Klar' : 'Mangler'}
                  </div>
                </div>
              </div>

              {getSiteLaunchState(launchSite).issues.length > 0 && (
                <div className="rounded-md border border-amber-300/70 bg-amber-100/50 px-4 py-3 text-sm text-amber-900 space-y-1">
                  <div className="font-medium">Før dette site kan gøres live, mangler der:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {getSiteLaunchState(launchSite).issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => launchSite && handleGoLive(launchSite)}
              disabled={!launchSite || !getSiteLaunchState(launchSite).isReady || Boolean(workingSiteId)}
            >
              {workingSiteId === launchSite?.id ? 'Gør live…' : 'Gør live'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
