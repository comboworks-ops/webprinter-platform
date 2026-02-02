---
description: Restore code from a backup tag
---

# Restore from Backup

Something went wrong and you need to restore from a backup. Follow this process carefully.

---

## 1. List Available Backups

```bash
git tag -l "backup/*" --sort=-creatordate
```

This shows backups sorted by date (newest first).

---

## 2. View What Changed Since Backup

Before restoring, see what would be reverted:

```bash
# Compare current state to backup
git diff backup/2026-02-02/before-pricing-change --stat
```

Or see full diff:
```bash
git diff backup/2026-02-02/before-pricing-change
```

---

## 3. Choose Restore Method

### Option A: Full Restore (Recommended for major issues)

This creates a new commit that reverts everything to the backup state:

```bash
# Save current state first (in case you need it)
git tag -a "backup/$(date +%Y-%m-%d)/before-restore" -m "State before restore"

# Restore to backup
git checkout backup/2026-02-02/before-pricing-change -- .
git add -A
git commit -m "Restore to backup/2026-02-02/before-pricing-change"
```

### Option B: Restore Specific Files Only

If only certain files are broken:

```bash
# Restore just pricing files
git checkout backup/2026-02-02/before-pricing-change -- src/utils/productPricing.ts src/lib/pricing/

# Restore just designer files
git checkout backup/2026-02-02/before-pricing-change -- src/components/designer/ src/pages/Designer.tsx

# Restore just branding files
git checkout backup/2026-02-02/before-pricing-change -- src/lib/branding/ src/hooks/useBrandingDraft.ts
```

Then commit the restored files:
```bash
git add -A
git commit -m "Restore specific files from backup"
```

### Option C: Create Branch from Backup (Safest)

If you want to compare or cherry-pick:

```bash
# Create branch from backup
git checkout -b restore-attempt backup/2026-02-02/before-pricing-change

# Compare, test, then merge if good
git checkout main  # or your working branch
git merge restore-attempt
```

---

## 4. Verify Restore

After restoring:

```bash
# Check TypeScript compiles
npx tsc --noEmit

# Start dev server
npm run dev

# Test the specific feature that was broken
```

---

## 5. Clean Up (Optional)

If restore was successful and you don't need the broken state:

```bash
# The broken code is still tagged if you used Option A
# You can delete it later if not needed:
git tag -d backup/2026-02-02/before-restore
```

---

## Common Restore Scenarios

### Pricing system broken
```bash
git checkout backup/YYYY-MM-DD/pricing-stable -- \
  src/utils/productPricing.ts \
  src/utils/storformatPricing.ts \
  src/lib/pricing/
```

### Designer export broken
```bash
git checkout backup/YYYY-MM-DD/designer-stable -- \
  src/pages/Designer.tsx \
  src/components/designer/ \
  src/lib/designer/export/ \
  src/utils/preflightChecks.ts
```

### Branding not working
```bash
git checkout backup/YYYY-MM-DD/branding-stable -- \
  src/lib/branding/ \
  src/hooks/useBrandingDraft.ts \
  src/contexts/PreviewBrandingContext.tsx \
  src/pages/Shop.tsx
```

---

## Emergency: Reset Everything

If you need to completely reset to a backup (DESTRUCTIVE - loses all changes):

```bash
# WARNING: This loses all uncommitted work!
git reset --hard backup/2026-02-02/before-pricing-change
```

Only use this if you're certain you want to discard everything.

---

## Related

- `/backup` - Create a backup before changes
