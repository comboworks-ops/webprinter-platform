---
description: Protected Admin Sidebar registry - do not remove or modify sidebar items without explicit user approval
---

# Protected Admin Sidebar Registry

> [!CAUTION]
> **NEVER remove, rename, or hide any item listed below without explicit user confirmation.**
> If a refactor or code change would affect any sidebar link, you MUST ask the user before proceeding.

## Shop Moduler Section

These items live in `src/components/admin/AdminSidebar.tsx` under the **Shop Moduler** collapsible group.
Each item also requires a matching `<Route>` in `src/pages/Admin.tsx`.

| Sidebar Label      | Route              | Component / Page              | Added    |
|--------------------|--------------------|-------------------------------|----------|
| Modul Oversigt     | /admin/moduler     | ShopModules                   | Original |
| Print Designer     | /admin/designer-templates | DesignerTemplateManager | Original |
| Site Design        | /admin/branding-v2 | TenantBrandingSettingsV2      | Original |
| Sites              | /admin/sites       | SitesAdmin                    | Original |
| Maskin-beregning   | /admin/machine-pricing | MachinePricingManager     | Original |
| Print on Demand    | /admin/pod-katalog | PodKatalog                    | Original |
| Company Hub        | /admin/companyhub  | AdminCompanyHub               | Original |
| Design Bibliotek   | /admin/ressourcer/designs | DesignResources        | Original |
| Farveprofiler      | /admin/farveprofiler | ColorProfilesManager        | Original |

## Checklist Before Any Sidebar Change

1. **Ask the user** — Get explicit approval before removing, hiding, or renaming any item.
2. **Update this file** — After any approved change, update the table above.
3. **Verify both files** — Every sidebar link needs both:
   - A `<SidebarMenuItem>` + `<AdminNavLink>` in `AdminSidebar.tsx`
   - A `<Route>` + import in `Admin.tsx`
