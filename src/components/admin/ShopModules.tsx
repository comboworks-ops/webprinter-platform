import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Gift,
  Loader2,
  Paintbrush,
  Palette,
  Play,
  Printer,
  Share2,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { useTenantModules } from "@/hooks/useTenantModules";
import {
  type ModuleAccessSource,
  type ShopModuleId,
} from "@/lib/modules/catalog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ShopModuleCard = {
  id: ShopModuleId;
  name: string;
  description: string;
  longDescription: string;
  icon: ReactNode;
  tier: "free" | "premium";
  route?: string;
  features: string[];
  color: string;
  previewImage?: string;
  previewVideo?: string;
  price?: string;
  comingSoon?: boolean;
};

type TenantOption = {
  id: string;
  name: string;
  domain: string | null;
};

const MODULE_CARDS: ShopModuleCard[] = [
  {
    id: "print-designer",
    name: "Print Designer",
    description: "Online designværktøj til tryksager",
    longDescription:
      "Giv dine kunder mulighed for at designe deres egne tryksager direkte i browseren med print-klare filer.",
    icon: <Paintbrush className="h-8 w-8" />,
    tier: "free",
    route: "/admin/designer-templates",
    features: [
      "Drag & drop editor",
      "Billede upload & redigering",
      "Soft proof med ICC profiler",
      "PDF eksport med bleed",
      "Skabeloner & design bibliotek",
    ],
    color: "from-fuchsia-500 to-pink-500",
    previewImage: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop",
  },
  {
    id: "site-design",
    name: "Site Design",
    description: "Branding og temaindstillinger",
    longDescription:
      "Tilpas webshop med logo, farver, skrifttyper og layout, så shoppen matcher jeres brand.",
    icon: <Palette className="h-8 w-8" />,
    tier: "free",
    route: "/admin/branding-v2",
    features: ["Logo & favicons", "Farvetemaer", "Typografi", "Bannere & billeder", "Navigation"],
    color: "from-indigo-500 to-violet-500",
    previewImage: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=450&fit=crop",
  },
  {
    id: "machine-pricing",
    name: "Maskin-beregning",
    description: "Automatisk prisberegning baseret på maskiner",
    longDescription:
      "Beregn produktpriser dynamisk med maskinprofiler, produktionstid og omkostninger.",
    icon: <Calculator className="h-8 w-8" />,
    tier: "premium",
    route: "/admin/machine-pricing",
    features: [
      "Maskinprofiler",
      "Materialeomkostninger",
      "Produktionstidsberegning",
      "Avanceberegning",
      "Automatisk prisopdatering",
    ],
    color: "from-blue-500 to-cyan-500",
    previewImage: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=450&fit=crop",
    price: "Fra 299 kr/md",
  },
  {
    id: "print-on-demand",
    name: "Print on Demand",
    description: "Dropshipping af tryksager",
    longDescription:
      "Sælg POD-produkter uden lager. Ordrer sendes til produktion automatisk.",
    icon: <Printer className="h-8 w-8" />,
    tier: "premium",
    route: "/admin/pod-katalog",
    features: [
      "POD produktkatalog",
      "Automatisk ordrebehandling",
      "Direkte levering til kunde",
      "Integration med produktion",
      "Øget avance",
    ],
    color: "from-emerald-500 to-green-500",
    previewImage: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&h=450&fit=crop",
    price: "Fra 499 kr/md",
  },
  {
    id: "company-hub",
    name: "Company Hub",
    description: "B2B portal for erhvervskunder",
    longDescription:
      "Giv erhvervskunder en dedikeret B2B portal med egne priser og reorder-flow.",
    icon: <Building2 className="h-8 w-8" />,
    tier: "premium",
    route: "/admin/companyhub",
    features: [
      "Virksomhedsprofiler",
      "Specialpriser per kunde",
      "Godkendelsesflows",
      "Ordrehistorik",
      "Budgetkontrol",
    ],
    color: "from-amber-500 to-orange-500",
    previewImage: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=450&fit=crop",
    price: "Fra 399 kr/md",
  },
  {
    id: "social-hub",
    name: "Social Hub",
    description: "Social medie integration",
    longDescription:
      "Integrer med sociale medier, produktdeling og kunde-engagement.",
    icon: <Share2 className="h-8 w-8" />,
    tier: "premium",
    features: [
      "Facebook & Instagram integration",
      "Produktdeling",
      "Kundeanmeldelser",
      "Social login",
      "Influencer samarbejde",
    ],
    color: "from-rose-500 to-pink-500",
    previewImage: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop",
    price: "Pris annonceres snart",
    comingSoon: true,
  },
];

const ACCESS_SOURCE_LABEL: Record<ModuleAccessSource, string> = {
  included: "Inkluderet",
  gifted: "Givet",
  purchased: "Købt",
  manual: "Manuel",
};

export function ShopModules() {
  const navigate = useNavigate();
  const [previewModule, setPreviewModule] = useState<ShopModuleCard | null>(null);
  const [isMasterContext, setIsMasterContext] = useState(false);
  const [baseTenantId, setBaseTenantId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveAdminTenant().then(async ({ tenantId, isMasterAdmin }) => {
      if (!active) return;
      setBaseTenantId(tenantId);
      const masterCtx = Boolean(isMasterAdmin && tenantId === MASTER_TENANT_ID);
      setIsMasterContext(masterCtx);
      setSelectedTenantId(tenantId);

      if (!masterCtx) return;
      const { data, error } = await supabase
        .from("tenants" as any)
        .select("id, name, domain")
        .neq("id", MASTER_TENANT_ID)
        .order("name", { ascending: true });
      if (error) {
        console.error("Could not load tenants:", error);
        return;
      }
      if (!active) return;
      setTenants((data as TenantOption[]) || []);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isMasterContext) return;
    if (!tenants.length) return;
    if (!selectedTenantId || selectedTenantId === MASTER_TENANT_ID) {
      setSelectedTenantId(tenants[0].id);
    }
  }, [isMasterContext, selectedTenantId, tenants]);

  const effectiveTenantId = selectedTenantId || baseTenantId || null;
  const moduleAccess = useTenantModules({ tenantId: effectiveTenantId });

  const freeModules = MODULE_CARDS.filter((module) => module.tier === "free");
  const premiumModules = MODULE_CARDS.filter((module) => module.tier === "premium");

  const handleToggleEnabled = async (moduleId: ShopModuleId, enabled: boolean) => {
    try {
      await moduleAccess.setModuleEnabled(moduleId, enabled);
      toast.success(enabled ? "Modul aktiveret" : "Modul deaktiveret");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Kunne ikke opdatere modulstatus.");
    }
  };

  const handleSetPremiumAccess = async (
    moduleId: ShopModuleId,
    hasAccess: boolean,
    source: ModuleAccessSource,
  ) => {
    try {
      await moduleAccess.setModuleAccess(moduleId, hasAccess, source);
      if (hasAccess) {
        toast.success(source === "gifted" ? "Modul givet til shoppen." : "Modul sat som købt.");
      } else {
        toast.success("Moduladgang fjernet.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Kunne ikke opdatere moduladgang.");
    }
  };

  const tenantLabel = useMemo(() => {
    if (!effectiveTenantId) return "Ingen tenant valgt";
    const selected = tenants.find((tenant) => tenant.id === effectiveTenantId);
    return selected ? selected.name : "Aktiv tenant";
  }, [effectiveTenantId, tenants]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          Shop Moduler
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Styr hvilke moduler der er tilgængelige og synlige for denne shop.
          Premium-moduler kan gives fra master eller markeres som købt.
        </p>
      </div>

      {isMasterContext && (
        <Card>
          <CardHeader>
            <CardTitle>Master styring</CardTitle>
            <CardDescription>Vælg tenant og administrer moduladgang (gave/købt) samt on/off.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="module-tenant-select">Tenant</Label>
            <select
              id="module-tenant-select"
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={effectiveTenantId || ""}
              onChange={(event) => setSelectedTenantId(event.target.value || null)}
            >
              <option value="">Vælg tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}{tenant.domain ? ` (${tenant.domain})` : ""}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {!effectiveTenantId ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Vælg en tenant for at administrere moduler.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold">Inkluderede moduler</h2>
            <Badge variant="outline">{tenantLabel}</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {freeModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                moduleState={moduleAccess.getModuleState(module.id)}
                onToggleEnabled={handleToggleEnabled}
                onSetPremiumAccess={handleSetPremiumAccess}
                onPreview={() => setPreviewModule(module)}
                onNavigate={() => module.route && navigate(module.route)}
                canManagePremium={isMasterContext}
                saving={moduleAccess.isSaving || moduleAccess.isLoading}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-semibold">Premium moduler</h2>
            <span className="text-sm text-muted-foreground">(Køb eller gave)</span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {premiumModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                moduleState={moduleAccess.getModuleState(module.id)}
                onToggleEnabled={handleToggleEnabled}
                onSetPremiumAccess={handleSetPremiumAccess}
                onPreview={() => setPreviewModule(module)}
                onNavigate={() => module.route && navigate(module.route)}
                canManagePremium={isMasterContext}
                saving={moduleAccess.isSaving || moduleAccess.isLoading}
              />
            ))}
          </div>
        </>
      )}

      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="flex flex-col md:flex-row items-center gap-6 py-6">
          <div className="p-4 bg-primary/10 rounded-full">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-semibold">Brug for hjælp til modulopsætning?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Kontakt platform-teamet hvis du vil sætte standardpakker op for flere shops.
            </p>
          </div>
          <Button variant="outline" className="shrink-0">
            <ExternalLink className="h-4 w-4 mr-2" />
            Kontakt os
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!previewModule} onOpenChange={() => setPreviewModule(null)}>
        <DialogContent className="max-w-4xl">
          {previewModule && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${previewModule.color} text-white`}>
                    {previewModule.icon}
                  </div>
                  {previewModule.name}
                </DialogTitle>
                <DialogDescription>{previewModule.description}</DialogDescription>
              </DialogHeader>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                {previewModule.previewVideo ? (
                  <video
                    src={previewModule.previewVideo}
                    controls
                    className="w-full h-full object-cover"
                    poster={previewModule.previewImage}
                  />
                ) : previewModule.previewImage ? (
                  <img
                    src={previewModule.previewImage}
                    alt={previewModule.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Play className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">{previewModule.longDescription}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModuleCard(props: {
  module: ShopModuleCard;
  moduleState: TenantModuleState | null;
  onToggleEnabled: (moduleId: ShopModuleId, enabled: boolean) => Promise<void>;
  onSetPremiumAccess: (moduleId: ShopModuleId, hasAccess: boolean, source: ModuleAccessSource) => Promise<void>;
  onPreview: () => void;
  onNavigate: () => void;
  canManagePremium: boolean;
  saving: boolean;
}) {
  const {
    module,
    moduleState,
    onToggleEnabled,
    onSetPremiumAccess,
    onPreview,
    onNavigate,
    canManagePremium,
    saving,
  } = props;

  const hasAccess = moduleState?.hasAccess ?? module.tier === "free";
  const enabled = moduleState?.enabled ?? (module.tier === "free");
  const accessSource = moduleState?.accessSource ?? (module.tier === "free" ? "included" : "manual");

  const statusBadge = module.comingSoon ? (
    <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
      <Clock className="h-3 w-3 mr-1" />
      Kommer snart
    </Badge>
  ) : hasAccess && enabled ? (
    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
      <CheckCircle2 className="h-3 w-3 mr-1" />
      Aktiv
    </Badge>
  ) : hasAccess ? (
    <Badge variant="secondary">
      <Clock className="h-3 w-3 mr-1" />
      Slukket
    </Badge>
  ) : (
    <Badge variant="outline" className="border-amber-400 text-amber-700">
      <Crown className="h-3 w-3 mr-1" />
      Ingen adgang
    </Badge>
  );

  const canOpen = !!module.route && hasAccess && enabled && !module.comingSoon;

  return (
    <Card className={`group relative overflow-hidden transition-all ${module.comingSoon ? "opacity-85" : ""}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${module.color} opacity-5`} />
      {module.previewImage && (
        <div className="relative h-40 overflow-hidden cursor-pointer" onClick={onPreview}>
          <img
            src={module.previewImage}
            alt={module.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color} text-white shadow-lg`}>
            {module.icon}
          </div>
          {statusBadge}
        </div>
        <CardTitle className="mt-4 text-xl">{module.name}</CardTitle>
        <CardDescription>{module.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Kilde:</span>
          <Badge variant="outline">{ACCESS_SOURCE_LABEL[accessSource]}</Badge>
          {module.price && <span className="ml-auto text-amber-700 font-medium">{module.price}</span>}
        </div>

        {module.tier === "premium" && !module.comingSoon && canManagePremium && (
          <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium">Premium adgang</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={hasAccess && accessSource === "gifted" ? "default" : "outline"}
                disabled={saving}
                onClick={() => onSetPremiumAccess(module.id, true, "gifted")}
              >
                <Gift className="h-4 w-4 mr-1" />
                Giv
              </Button>
              <Button
                size="sm"
                variant={hasAccess && accessSource === "purchased" ? "default" : "outline"}
                disabled={saving}
                onClick={() => onSetPremiumAccess(module.id, true, "purchased")}
              >
                <Crown className="h-4 w-4 mr-1" />
                Markér købt
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !hasAccess}
                onClick={() => onSetPremiumAccess(module.id, false, "manual")}
              >
                Fjern
              </Button>
            </div>
          </div>
        )}

        {module.tier === "premium" && !hasAccess && !canManagePremium && !module.comingSoon && (
          <p className="text-xs text-muted-foreground rounded-md border p-2">
            Modulet er ikke aktiveret for denne shop.
          </p>
        )}

        {!module.comingSoon && hasAccess && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor={`module-enabled-${module.id}`} className="text-sm font-medium">
                Vis modul i frontend/admin
              </Label>
              <p className="text-xs text-muted-foreground">Slå modulet helt til eller fra for shoppen.</p>
            </div>
            <Switch
              id={`module-enabled-${module.id}`}
              checked={enabled}
              disabled={saving}
              onCheckedChange={(checked) => onToggleEnabled(module.id, checked)}
            />
          </div>
        )}

        <ul className="space-y-1.5">
          {module.features.slice(0, 3).map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm">
              <Sparkles className="h-3 w-3 text-primary shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
          {module.features.length > 3 && (
            <li className="text-xs text-muted-foreground ml-5">+{module.features.length - 3} flere...</li>
          )}
        </ul>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
            <Play className="h-4 w-4 mr-2" />
            Preview
          </Button>
          {canOpen ? (
            <Button size="sm" className="flex-1" onClick={onNavigate}>
              Åbn
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="secondary" size="sm" className="flex-1" disabled>
              {module.comingSoon ? "Kommer snart" : "Låst"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ShopModules;
import type { TenantModuleState } from "@/hooks/useTenantModules";
