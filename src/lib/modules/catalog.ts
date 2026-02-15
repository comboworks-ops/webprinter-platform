export type ShopModuleId =
  | "print-designer"
  | "site-design"
  | "machine-pricing"
  | "print-on-demand"
  | "company-hub"
  | "social-hub";

export type ShopModuleTier = "free" | "premium";
export type ModuleAccessSource = "included" | "gifted" | "purchased" | "manual";

export interface ShopModuleDefinition {
  id: ShopModuleId;
  name: string;
  tier: ShopModuleTier;
  defaultAccess: boolean;
  defaultEnabled: boolean;
}

export const SHOP_MODULE_DEFINITIONS: ShopModuleDefinition[] = [
  {
    id: "print-designer",
    name: "Print Designer",
    tier: "free",
    defaultAccess: true,
    defaultEnabled: true,
  },
  {
    id: "site-design",
    name: "Site Design",
    tier: "free",
    defaultAccess: true,
    defaultEnabled: true,
  },
  {
    id: "machine-pricing",
    name: "Maskin-beregning",
    tier: "premium",
    defaultAccess: false,
    defaultEnabled: false,
  },
  {
    id: "print-on-demand",
    name: "Print on Demand",
    tier: "premium",
    defaultAccess: false,
    defaultEnabled: false,
  },
  {
    id: "company-hub",
    name: "Company Hub",
    tier: "premium",
    defaultAccess: false,
    defaultEnabled: false,
  },
  {
    id: "social-hub",
    name: "Social Hub",
    tier: "premium",
    defaultAccess: false,
    defaultEnabled: false,
  },
];

export const MODULE_BY_ID: Record<ShopModuleId, ShopModuleDefinition> =
  SHOP_MODULE_DEFINITIONS.reduce((acc, moduleDef) => {
    acc[moduleDef.id] = moduleDef;
    return acc;
  }, {} as Record<ShopModuleId, ShopModuleDefinition>);

export const ADMIN_ROUTE_MODULE_MAP: Partial<Record<string, ShopModuleId>> = {
  "/admin/designer-templates": "print-designer",
  "/admin/branding-v2": "site-design",
  "/admin/sites": "site-design",
  "/admin/machine-pricing": "machine-pricing",
  "/admin/pod-katalog": "print-on-demand",
  "/admin/companyhub": "company-hub",
};

export const FRONTEND_ROUTE_MODULE_MAP: Partial<Record<string, ShopModuleId>> = {
  "/company": "company-hub",
};
