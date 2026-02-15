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
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SITE_PACKAGES, SITE_PACKAGE_MAP, type SitePackage } from '@/lib/sites/sitePackages';
import { buildPreviewShopUrl } from '@/lib/preview/previewSession';
import {
  installSitePackageTemplates,
  type SiteInstallSummary,
} from '@/lib/sites/installSitePackage';

type TenantData = {
  id: string;
  name: string;
  settings: any;
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

  const siteState = useMemo(() => parseSiteFrontendState(tenant?.settings), [tenant?.settings]);

  const activeSite = siteState.activeSiteId ? SITE_PACKAGE_MAP[siteState.activeSiteId] : undefined;

  const persistSettings = async (nextSettings: any) => {
    if (!tenant) return;

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
      const { tenantId } = await resolveAdminTenant();

      if (!tenantId) {
        setTenant(null);
        return;
      }

      const { data, error } = await supabase
        .from('tenants' as any)
        .select('id, name, settings')
        .eq('id', tenantId)
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

  const getPreviewHref = (siteId: string) => {
    if (!tenant) return '/preview-shop';
    return buildPreviewShopUrl({
      tenantId: tenant.id,
      siteId,
      sitePreviewMode: true,
      page: '/',
    });
  };

  const handleActivateSite = async (sitePackage: SitePackage) => {
    if (!tenant) return;

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

  const handleInstallSite = async (sitePackage: SitePackage) => {
    if (!tenant) return;

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

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isWorking}
                    onClick={() => handleActivateSite(sitePackage)}
                  >
                    {isWorking ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Aktivér site
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
                    disabled={isWorking || (counts.formats + counts.materials + counts.finishes + counts.products === 0)}
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
