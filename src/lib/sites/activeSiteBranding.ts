import { SITE_PACKAGE_MAP } from '@/lib/sites/sitePackages';

function getActiveSiteId(settings: any, overrideSiteId?: string | null): string | null {
  if (overrideSiteId && typeof overrideSiteId === 'string') {
    return overrideSiteId;
  }

  const activeSiteId = settings?.site_frontends?.activeSiteId;
  return typeof activeSiteId === 'string' ? activeSiteId : null;
}

export function getActiveSiteThemeId(settings: any, overrideSiteId?: string | null): string | null {
  const activeSiteId = getActiveSiteId(settings, overrideSiteId);
  if (!activeSiteId) return null;

  const sitePackage = SITE_PACKAGE_MAP[activeSiteId];
  return sitePackage?.recommendedThemeId || null;
}

export function applyActiveSiteThemeToBranding(
  branding: any,
  settings: any,
  overrideSiteId?: string | null
): any {
  if (!branding || typeof branding !== 'object') return branding;

  const activeSiteId = getActiveSiteId(settings, overrideSiteId);
  const activeSiteThemeId = getActiveSiteThemeId(settings, overrideSiteId);

  if (!activeSiteThemeId) return branding;

  return {
    ...branding,
    themeId: activeSiteThemeId,
    themeSettings: {
      ...(branding.themeSettings || {}),
      activeSiteId,
    },
  };
}
