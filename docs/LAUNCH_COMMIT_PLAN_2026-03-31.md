# Launch-only Commit Plan 2026-03-31

Mål: isolere launch-relevante ændringer i en separat commit uden at blande Canva, machine UI, site design v2 eller POD3 ind.

## Commit A — Launch/runtime changes
Denne commit samler det, der allerede påvirker live platform/storefront, kontaktflow, metadata og mail-routing.

### Stage disse filer
```bash
git add \
  index.html \
  vercel.json \
  src/App.tsx \
  src/main.tsx \
  src/hooks/useShopSettings.ts \
  src/components/SEO.tsx \
  src/components/platform-seo/PlatformSeoHead.tsx \
  src/components/storefront/StorefrontSeo.tsx \
  src/components/content/ContactContent.tsx \
  src/components/content/PlatformTermsContent.tsx \
  src/components/content/PrivacyPolicyContent.tsx \
  src/pages/About.tsx \
  src/pages/Contact.tsx \
  src/pages/Shop.tsx \
  src/pages/ShopContact.tsx \
  src/pages/Terms.tsx \
  src/pages/PrivacyPolicy.tsx \
  src/pages/TenantSignup.tsx \
  src/pages/platform/Cookiepolitik.tsx \
  src/pages/platform/PlatformHandelsbetingelser.tsx \
  src/pages/platform/PlatformKontakt.tsx \
  src/pages/platform/PlatformPriser.tsx \
  src/pages/platform/PlatformPrivacyPolicy.tsx \
  src/components/admin/TenantOverview.tsx \
  src/lib/platform-seo/metadata.ts \
  src/lib/platform-seo/sitemap.ts \
  src/lib/platform-seo/types.ts \
  src/lib/storefront/seo.ts \
  src/lib/contact/sendContactMessage.ts \
  api/tenant-shell.ts \
  api/storefront-brandmark.ts \
  supabase/config.toml \
  supabase/functions/send-contact-message/index.ts \
  supabase/functions/send-order-email/index.ts \
  supabase/functions/send-quote-emails/index.ts \
  public/platform-favicon.svg \
  public/platform-og-image.png
```

### Commit message
```bash
git commit -m "fix: stabilize launch storefront contact and seo flows"
```

## Commit B — Optional launch docs + local hygiene
Denne commit er ikke runtime-kritisk. Den holder docs og lokal oprydning ude af runtime-commiten.

### Stage disse filer
```bash
git add \
  .gitignore \
  docs/LAUNCH_PREP_2026-03-27.md \
  docs/GO_LIVE_READINESS_LOG.md \
  docs/WORKTREE_SCOPE_2026-03-30.md \
  docs/LAUNCH_COMMIT_PLAN_2026-03-31.md
```

### Commit message
```bash
git commit -m "docs: record launch scope and local cleanup rules"
```

## Må ikke stages endnu
Disse områder er tydeligt i gang og bør ikke blandes ind i launch-commits.

### Machine/pricing UI
- `src/components/admin/MachineForm.tsx`
- `src/components/admin/MachinePricingManager.tsx`
- `src/components/admin/PricingProfileForm.tsx`
- `src/components/admin/InkSetForm.tsx`
- `src/components/admin/MaterialForm.tsx`
- `src/components/admin/MarginProfileForm.tsx`
- `src/components/admin/ImpositionPreview.tsx`

### Canva/template/designer
- `src/components/admin/DesignerTemplateManager.tsx`
- `src/components/designer/DesignLibraryDrawer.tsx`
- `src/hooks/useDesignLibrary.ts`
- `src/lib/designer/templateLibrary.ts`
- `src/lib/canva/`
- `src/pages/CanvaReturn.tsx`
- `supabase/migrations/20260326120000_template_library_v2.sql`

### Site design v2 / branding editor
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/SiteDesignPreviewFrame.tsx`
- `src/components/admin/TenantSiteDesignV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/lib/branding/*`
- `src/lib/siteDesignTargets.ts`

### POD3 / supplier work / scripts
- `src/components/pod3/`
- `src/pages/admin/Pod3FlyerAlarm.tsx`
- `supabase/functions/pod3-flyeralarm-request/`
- `supabase/functions/pod2x-printcom-proxy/`
- `scripts/fetch-pixart-flat-surface-adhesive-import.mjs`
- `check-*.cjs`, `fix-*.cjs`, `migrate-*.cjs`, `test-prices.cjs`

## Før commit
Kør disse checks før Commit A:
```bash
git diff --cached --stat
npm run build
```

## Efter commit
Hvis committen ser ren ud:
```bash
git push origin main
```

Bemærk: push bør først ske efter en hurtig gennemlæsning af staged diff, fordi flere launch-filer også er ændret i en beskidt worktree.
