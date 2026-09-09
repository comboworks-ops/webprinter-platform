import { useLocation } from 'react-router-dom';
import { resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import { usePreviewBranding } from '@/contexts/PreviewBrandingContext';

export function useOrderFlowDesign(page: OrderFlowPage, branding?: { themeSettings?: Record<string, unknown> } | null) {
  const location = useLocation();
  const editorPreview = usePreviewBranding();
  // A URL changes only this local preview. Published storefronts use branding settings.
  const preview = import.meta.env.DEV ? new URLSearchParams(location.search).get('orderDesign') : null;
  return resolveOrderFlowDesign(page, editorPreview.isPreviewMode && editorPreview.branding ? editorPreview.branding : branding, preview);
}
