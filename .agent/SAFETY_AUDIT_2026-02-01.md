# Webprinter Platform - Safety Audit & Development Guidelines

> **Created**: February 1, 2026
> **Last Updated**: February 2, 2026 (tenant isolation fix)
> **Purpose**: Safe development workflow to prevent breaking working systems

---

## ✅ FIXES APPLIED (February 1, 2026)

| Fix | Status | Details |
|-----|--------|---------|
| Moved backup folder | ✅ Done | `src/backup-2026-01-11-product-config/` → `.archive/` |
| Removed `node_modules_to_delete/` | ✅ Done | Was causing Vite reload spam |
| Removed debug console.log | ✅ Done | Cleaned `AdminMessages.tsx`, `pricingDatabase.ts`, `usePaidItems.ts`, `adminTenant.ts` |
| Fixed WRONG tenant ID | ✅ Done | `platform-seo/hooks.ts` was using incorrect UUID - now imports correct constant |
| Build verification | ✅ Passed | `npm run build` succeeds |
| parseInt radix | ⏳ Deferred | 40+ locations - low priority, no behavior change |
| Dropdown z-index fix | ✅ Done | All header dropdowns now appear above fixed headers |
| Restored missing files | ✅ Done | Pod2Admin.tsx, Pod2Katalog.tsx, StripePaymentForm.tsx restored from git |
| Tenant isolation fix | ✅ Done | Products no longer flicker to master tenant; auth state checked before query runs |

---

## 🚨 CRITICAL: DO NOT TOUCH ZONES

These systems are **PROTECTED** and work correctly. Modifying them without explicit permission risks breaking core functionality.

### 1. Print Designer Core (HIGH RISK)
| File | Purpose | Risk Level |
|------|---------|------------|
| `src/pages/Designer.tsx` | Main designer page | 🔴 EXTREME |
| `src/components/designer/EditorCanvas.tsx` | Fabric.js canvas wrapper | 🔴 EXTREME |
| `src/utils/imageMetadata.ts` | DPI extraction | 🔴 EXTREME |
| `src/utils/preflightChecks.ts` | Print validation rules | 🔴 EXTREME |

**Why**: These files handle canvas sizing, physical scaling, and print-ready validation. A single wrong constant breaks all exports.

### 2. Soft Proofing System (HIGH RISK)
| File | Purpose | Risk Level |
|------|---------|------------|
| `src/hooks/useColorProofing.ts` | ICC transform management | 🔴 EXTREME |
| `src/workers/colorProofing.worker.ts` | lcms-wasm Web Worker | 🔴 EXTREME |
| `src/lib/color/iccProofing.ts` | Profile configuration | 🟠 HIGH |

**Why**: Uses specific 3-parameter lcms-wasm API. Wrong parameter count causes "offset out of bounds" errors.

### 3. Vector PDF Export (HIGH RISK)
| File | Purpose | Risk Level |
|------|---------|------------|
| `src/lib/designer/export/exportVectorPdfBackground.ts` | Vector preservation | 🔴 EXTREME |
| `src/lib/designer/export/computeExportCropRect.ts` | Crop calculations | 🟠 HIGH |
| `src/lib/designer/export/hideExportGuides.ts` | Guide hiding | 🟠 HIGH |

**Why**: Preserves vector content from imported PDFs. Wrong crop math ruins print files.

### 4. Pricing System (BUSINESS CRITICAL)
| File | Purpose | Risk Level |
|------|---------|------------|
| `src/utils/productPricing.ts` | Price calculations | 🔴 EXTREME |
| `src/lib/pricing/machinePricingEngine.ts` | MPA engine | 🔴 EXTREME |
| `src/components/product-price-page/PriceMatrix.tsx` | Matrix display | 🟠 HIGH |

**Why**: Wrong pricing = business disaster. Any change here must be tested extensively.

### 5. POD Systems (PROTECTED)
| File | Purpose | Risk Level |
|------|---------|------------|
| `src/lib/pod/` | POD v1 hooks/types | 🟠 HIGH |
| `src/lib/pod2/` | POD v2 hooks/types | 🟠 HIGH |
| `src/pages/admin/Pod2Admin.tsx` | POD v2 admin | 🟠 HIGH |
| `src/pages/admin/Pod2Katalog.tsx` | POD v2 catalog | 🟠 HIGH |

**Why**: POD v1 and v2 must remain separate. Changes can break Print.com integration.

---

## ⚠️ KNOWN BUGS & ISSUES (By Severity)

### 🔴 CRITICAL (Fix ASAP)

| Issue | Location | Description |
|-------|----------|-------------|
| Hardcoded Master Tenant ID | `src/lib/platform-seo/hooks.ts:16` | Should be env variable |
| node_modules_to_delete folder | Root directory | Causing Vite reload spam |
| Missing error handling | `src/components/admin/AdminMessages.tsx` | Unhandled promise rejections |

### 🟠 HIGH (Fix Soon)

| Issue | Location | Description |
|-------|----------|-------------|
| 158+ `as any` type casts | Throughout codebase | Bypasses TypeScript safety |
| Console.log in production | Multiple files | Security/performance concern |
| Aggressive polling (5s) | `AdminMessages.tsx:98` | Memory leak potential |
| Unsafe innerHTML | `TenantPaymentSettings.tsx:71,101` | XSS risk |
| parseInt without radix | 30+ locations | Unexpected parsing behavior |

### 🟡 MEDIUM (Plan to Fix)

| Issue | Location | Description |
|-------|----------|-------------|
| Mock PageSpeed data | `PlatformSeoAnalytics.tsx:73-88` | Returns random numbers |
| TODO: master reply logic | `AdminMessages.tsx:237` | Incomplete feature |
| Backup folder | `src/backup-2026-01-11-product-config/` | Should be archived |
| Inconsistent localStorage | Multiple files | SSR safety not standardized |
| Unused imports pattern | Various | Code maintenance burden |

### 🟢 LOW (Nice to Have)

| Issue | Location | Description |
|-------|----------|-------------|
| Mixed Danish/English | Throughout | Inconsistent i18n |
| Error message quality | Various | Generic error messages |
| Performance tuning | Designer, BrandingPreview | Many setTimeout calls |

---

## ✅ SYSTEMS THAT WORK (Don't Break These)

### Verified Working Features

1. **Branding System** ✓
   - Draft/publish workflow
   - Live preview via postMessage
   - 4-tab editor (Forside, Typography, Colors, Icons)
   - Header/footer customization
   - CTA button colors and hover effects

2. **Print Designer** ✓
   - Canvas zones (bleed, trim, safe)
   - Physical scaling on import
   - Live dimension labels
   - Preflight warnings
   - PDF export with CMYK colors
   - Soft proofing overlay

3. **Company Hub (B2B Portal)** ✓
   - Member management
   - Product pinning
   - Direct portal links
   - Email sync

4. **Multi-Tenant Architecture** ✓
   - Tenant resolution
   - RLS policies
   - Role system (master_admin, admin, user)

5. **Design Library** ✓
   - Three tabs (Mine, Skabeloner, Ressourcer)
   - Thumbnail generation
   - Save/load designs

---

## 🛡️ SAFE DEVELOPMENT WORKFLOW

### Before Making Any Changes

```
1. Check if file is in a PROTECTED workflow
   └── Read .agent/workflows/*.md

2. Check AGENTS.md for Do/Don't rules

3. If touching pricing or POD:
   └── Read POD2_README.md first

4. If touching designer/canvas:
   └── Read .agent/HANDOVER.md first
```

### Safe Change Process

```
Step 1: Create branch
   git checkout -b feature/your-change

Step 2: Verify what you're touching
   - Is it a protected file? → Get explicit permission
   - Is it pricing logic? → Test extensively
   - Is it canvas/export? → Test all export modes

Step 3: Make minimal changes
   - Prefer additive over destructive
   - Don't refactor "nearby" code
   - Don't add comments/types to unchanged code

Step 4: Test before committing
   - Run `npm run build` (catches type errors)
   - Test in browser on localhost:8080
   - Check Vite console for errors

Step 5: Document if needed
   - Update relevant .md files
   - Add to AGENTS.md if new rules
```

---

## 📁 EXISTING PROTECTION RULES

### Files Already Protected

| Workflow | Files | Rule |
|----------|-------|------|
| `/physical-scaling-import` | imageMetadata.ts, EditorCanvas.tsx, Designer.tsx | DO NOT MODIFY scaling logic |
| `/soft-proof-protected` | colorProofing.worker.ts, useColorProofing.ts | DO NOT CHANGE lcms-wasm API usage |
| `/preflight-protected` | preflightChecks.ts | DO NOT ALTER boundary calculations |
| `/vector-pdf-protected` | export/*.ts | DO NOT BREAK vector preservation |
| `/color-picker` | ColorPickerWithSwatches | ALWAYS use this component |

### Design Rules (from rules.md)

- DO NOT change HeroSlider layout/alignment
- DO NOT remove compact aesthetics in admin sidebar
- DO NOT simplify button color logic
- ALWAYS use `inline` prop for FontSelector and ColorPicker

---

## 🎯 RECOMMENDED NEXT STEPS

### Immediate (Today)

1. **Delete `node_modules_to_delete/` folder**
   ```bash
   rm -rf "/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main/node_modules_to_delete"
   ```

2. **Move backup folder out of src/**
   ```bash
   mv src/backup-2026-01-11-product-config/ ../backups/
   ```

### Short-Term (This Week)

3. **Fix hardcoded tenant ID**
   - Add `VITE_MASTER_TENANT_ID` to .env
   - Update `src/lib/platform-seo/hooks.ts`

4. **Remove console.log statements**
   - Run: `grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | wc -l`
   - Create ticket to clean up

### Medium-Term (This Month)

5. **Replace `as any` with proper types**
   - Focus on admin components first
   - Use Supabase generated types

6. **Standardize error handling**
   - Create error boundary component
   - Use toast consistently

---

## 📋 QUICK REFERENCE

### Constants (DO NOT CHANGE)

| Constant | Value | Location |
|----------|-------|----------|
| `DISPLAY_DPI` | 50.8 | EditorCanvas.tsx |
| `PASTEBOARD_PADDING` | 100 | EditorCanvas.tsx |
| `MM_TO_PX` | ~2.0 | Designer.tsx |
| `MAX_PREVIEW_DIMENSION` | 1000 | useColorProofing.ts |

### Header z-index Pattern (FOLLOW THIS)

| Component | Header z-index | Dropdown z-index |
|-----------|----------------|------------------|
| Header.tsx | z-[1000] | z-[1001] |
| AdminHeader.tsx | z-50 | z-[51] |
| PlatformHeader.tsx | z-50 | z-[51] |

**Rule**: Dropdowns must always be 1 higher than their parent header (Radix UI portals to body).

### Master Tenant UUID

```
00000000-0000-0000-0000-000000000000
```

### Dev Server

```bash
npm run dev -- --port 8080
# Opens at http://localhost:8080
```

---

## ✅ How to Use This Document

1. **Before any coding session**: Read the "DO NOT TOUCH" section
2. **Before changing a file**: Check if it's protected
3. **When fixing bugs**: Start with CRITICAL, then HIGH
4. **When adding features**: Follow Safe Development Workflow
5. **When in doubt**: Ask before changing protected files

---

*This document should be updated whenever new protected systems are added or bugs are fixed.*
