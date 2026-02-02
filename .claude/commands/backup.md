---
description: Create a backup point before making risky changes
---

# Backup Before Changes

You've been asked to create a backup before modifying critical code. Follow this process:

---

## 1. Check Current State

First, ensure the working directory is clean:

```bash
git status
```

If there are uncommitted changes, either:
- Commit them first: `git add -A && git commit -m "WIP: save before backup"`
- Or stash them: `git stash push -m "stash before backup"`

---

## 2. Create Backup Tag

Create a timestamped tag with a descriptive name:

```bash
# Format: backup/YYYY-MM-DD/description
git tag -a "backup/$(date +%Y-%m-%d)/before-pricing-change" -m "Backup before pricing system changes"
```

**Common backup tag names:**
- `backup/2026-02-02/before-pricing-change`
- `backup/2026-02-02/before-designer-update`
- `backup/2026-02-02/before-branding-refactor`
- `backup/2026-02-02/stable-production`

---

## 3. Verify Backup Created

```bash
git tag -l "backup/*" --sort=-creatordate | head -5
```

This shows your 5 most recent backups.

---

## 4. Proceed with Changes

Now you can safely make changes. If something goes wrong, use `/restore` to roll back.

---

## Quick Backup Commands

**Create backup for specific domain:**

```bash
# Pricing backup
git tag -a "backup/$(date +%Y-%m-%d)/pricing-stable" -m "Stable pricing before changes"

# Designer backup
git tag -a "backup/$(date +%Y-%m-%d)/designer-stable" -m "Stable designer before changes"

# Branding backup
git tag -a "backup/$(date +%Y-%m-%d)/branding-stable" -m "Stable branding before changes"
```

**List all backups:**
```bash
git tag -l "backup/*" --sort=-creatordate
```

**Push backups to remote (optional):**
```bash
git push origin --tags
```

---

## When to Create Backups

Always create a backup before:
- Modifying pricing calculations or matrices
- Changing designer export or canvas logic
- Updating branding data flow
- Database migrations
- Refactoring shared utilities
- Any change you're not 100% confident about

---

## Related

- `/restore` - Restore from a backup tag
- `/pricing-change` - Safe pricing modifications
- `/designer-change` - Safe designer modifications
