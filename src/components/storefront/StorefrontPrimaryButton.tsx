import { resolveSharedButton, sharedButtonAttributes } from '@/lib/branding/sharedButtons';
import '@/styles/sharedButtons.css';
import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { usePreviewBranding } from '@/contexts/PreviewBrandingContext';
import { useShopSettings } from '@/hooks/useShopSettings';
import { primaryButtonStyle } from '@/lib/branding/primaryButtonStyle';
import '@/styles/storefrontPrimaryButton.css';

/** Explicit primary actions, including portalled payment and proof dialogs. */
export const StorefrontPrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(function StorefrontPrimaryButton({ className = '', style, ...props }, ref) {
  const preview = usePreviewBranding();
  const shop = useShopSettings();
  const branding = preview.isPreviewMode && preview.branding ? preview.branding : shop.data?.branding;
  const shared = sharedButtonAttributes(resolveSharedButton(branding, 'cta', 'order'), 'cta');
  return <Button {...props} {...shared} ref={ref} className={`storefront-primary-action ${className}`} style={{ ...primaryButtonStyle(branding), ...style, ...shared.style }} />;
});
