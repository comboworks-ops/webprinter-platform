import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { buildPreviewShopUrl, readPreviewSession } from '@/lib/preview/previewSession';

interface PreviewRouteRedirectProps {
  children: ReactNode;
}

/**
 * Keeps a preview tab inside /preview-shop even if components perform route navigation.
 * This avoids dropping into the live storefront routes while testing site previews.
 */
export function PreviewRouteRedirect({ children }: PreviewRouteRedirectProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const isPreviewQuery =
    params.get('preview_mode') === '1' || params.get('draft') === '1';

  const previewSession = readPreviewSession();
  const shouldForcePreview = isPreviewQuery || Boolean(previewSession);

  if (!shouldForcePreview) {
    return <>{children}</>;
  }

  const tenantId =
    params.get('tenantId') ||
    params.get('tenant_id') ||
    previewSession?.tenantId ||
    null;

  const siteId =
    params.get('siteId') ||
    params.get('site_id') ||
    previewSession?.siteId ||
    null;

  const sitePreviewMode =
    params.get('sitePreview') === '1' || previewSession?.sitePreviewMode === true;

  const page = location.pathname;

  return (
    <Navigate
      replace
      to={buildPreviewShopUrl({
        tenantId,
        siteId,
        sitePreviewMode,
        page,
      })}
    />
  );
}
