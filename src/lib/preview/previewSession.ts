const PREVIEW_SESSION_KEY = 'wp_preview_shop_session';

export interface PreviewSession {
  tenantId: string | null;
  siteId: string | null;
  sitePreviewMode: boolean;
  updatedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
}

export function readPreviewSession(): PreviewSession | null {
  if (!isBrowser()) return null;

  try {
    const raw = sessionStorage.getItem(PREVIEW_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PreviewSession;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : null,
      siteId: typeof parsed.siteId === 'string' ? parsed.siteId : null,
      sitePreviewMode: parsed.sitePreviewMode === true,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writePreviewSession(input: {
  tenantId?: string | null;
  siteId?: string | null;
  sitePreviewMode?: boolean;
}): void {
  if (!isBrowser()) return;

  const value: PreviewSession = {
    tenantId: input.tenantId || null,
    siteId: input.siteId || null,
    sitePreviewMode: input.sitePreviewMode === true,
    updatedAt: new Date().toISOString(),
  };

  sessionStorage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(value));
}

export function clearPreviewSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(PREVIEW_SESSION_KEY);
}

export function buildPreviewShopUrl(input: {
  tenantId?: string | null;
  siteId?: string | null;
  sitePreviewMode?: boolean;
  page?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('preview_mode', '1');

  if (input.tenantId) {
    params.set('tenantId', input.tenantId);
  }

  if (input.siteId) {
    params.set('siteId', input.siteId);
  }

  if (input.sitePreviewMode) {
    params.set('sitePreview', '1');
  }

  const safePage = input.page && input.page.startsWith('/') ? input.page : '/';
  params.set('page', safePage);

  return `/preview-shop?${params.toString()}`;
}
