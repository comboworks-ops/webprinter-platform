# Worktree Scope 2026-03-30

Formål: give et sikkert overblik over den nuværende worktree uden at slette eller rulle noget tilbage.

## 1. Launch-relevante ændringer
Disse filer hænger direkte sammen med live ændringer omkring kontakt, metadata, tenant/platform-separation og launch-audit.

- `index.html`
- `vercel.json`
- `api/tenant-shell.ts`
- `api/storefront-brandmark.ts`
- `src/components/SEO.tsx`
- `src/components/platform-seo/PlatformSeoHead.tsx`
- `src/components/storefront/StorefrontSeo.tsx`
- `src/components/content/ContactContent.tsx`
- `src/pages/platform/PlatformKontakt.tsx`
- `src/pages/Shop.tsx`
- `src/pages/ShopContact.tsx`
- `src/pages/About.tsx`
- `src/pages/Terms.tsx`
- `src/pages/TenantSignup.tsx`
- `src/components/admin/TenantOverview.tsx`
- `src/lib/contact/sendContactMessage.ts`
- `src/lib/storefront/seo.ts`
- `src/lib/platform-seo/metadata.ts`
- `src/lib/platform-seo/types.ts`
- `src/lib/platform-seo/sitemap.ts`
- `supabase/config.toml`
- `supabase/functions/send-contact-message/index.ts`
- `supabase/functions/send-order-email/index.ts`
- `supabase/functions/send-quote-emails/index.ts`
- `public/platform-og-image.png`
- `public/platform-favicon.svg`
- `docs/LAUNCH_PREP_2026-03-27.md`
- `docs/GO_LIVE_READINESS_LOG.md`

## 2. Featurearbejde der ikke bør blandes ukritisk ind i launch-commit
Disse grupper ser ud til at være reelt byggearbejde og bør holdes adskilt i egne commits eller branches.

### Machine/pricing UI
- `src/components/admin/MachineForm.tsx`
- `src/components/admin/MachinePricingManager.tsx`
- `src/components/admin/PricingProfileForm.tsx`
- `src/components/admin/InkSetForm.tsx`
- `src/components/admin/MaterialForm.tsx`
- `src/components/admin/MarginProfileForm.tsx`
- `src/components/admin/ImpositionPreview.tsx`

### Template/Canva/designer library
- `src/components/admin/DesignerTemplateManager.tsx`
- `src/components/designer/DesignLibraryDrawer.tsx`
- `src/hooks/useDesignLibrary.ts`
- `src/lib/designer/templateLibrary.ts`
- `src/lib/canva/`
- `src/pages/CanvaReturn.tsx`
- `supabase/migrations/20260326120000_template_library_v2.sql`

### Site design / branding editor v2
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/SiteDesignPreviewFrame.tsx`
- `src/components/admin/TenantSiteDesignV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/lib/branding/*`
- `src/lib/siteDesignTargets.ts`

### POD3 / supplier integrations / imports
- `src/components/pod3/`
- `src/pages/admin/Pod3FlyerAlarm.tsx`
- `supabase/functions/pod3-flyeralarm-request/`
- `supabase/functions/pod2x-printcom-proxy/`
- `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
- diverse `fix-*.cjs`, `check-*.cjs`, `migrate-*.cjs`

## 3. Lokale/genererede artefakter
Disse er nu ignoreret eller bør behandles som lokal støj, ikke produktkode.

- `dist-check/`
- `dist-check*/`
- `.playwright-cli/`
- `.TODO_DROPDOWN_IMAGE`
- `.agent/SITE_DESIGN_V2_SCRATCHPAD.tmp`

## 4. Kendt tracked støj
Denne fil er tracked og vil derfor stadig dukke op i status, selv om den ofte bare er lokal CLI-støj.

- `supabase/.temp/cli-latest`

## 5. Praktisk næste skridt
Hvis repoet skal gøres commit-klar uden at miste arbejde, bør næste skridt være:

1. isolere launch-filerne i en separat commit
2. lade featuregrupperne blive lokale indtil de er færdige
3. undgå at blande machine UI, Canva, site design og POD3 sammen med launch-fixene
