import { usesWideFormat } from '@/lib/branding/wideFormatDesigns';
import { signalSettings } from '@/lib/branding/pvcbannerSettings';
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
  const signal = usesWideFormat(branding,preview.isPreviewMode ? new URLSearchParams(window.location.search).get('tenantId') : shop.data?.id);
  const b = signalSettings(branding);
  const signalStyle = signal ? {
    '--shop-action-bg': b.buttonStyle === 'outline' ? 'transparent' : b.buttonBackground,
    '--shop-action-hover': b.buttonStyle === 'outline' ? 'transparent' : b.buttonBackground,
    '--shop-action-text': b.buttonStyle === 'outline' ? b.buttonBackground : b.buttonTextColor,
    '--shop-action-hover-text': b.buttonStyle === 'outline' ? b.buttonBackground : b.buttonTextColor,
    '--shop-action-border': b.buttonBackground, '--shop-action-hover-border': b.buttonBackground,
    '--shop-action-radius': `${b.buttonRadius}px`, '--shop-action-font': `${b.buttonSize}px`,
    '--shop-action-padding': '14px', '--shop-action-padding-x': `${b.buttonPadding}px`,
  } : {};
  return <Button {...props} {...shared} ref={ref} className={`storefront-primary-action ${className}`} style={{ ...primaryButtonStyle(branding), ...style, ...shared.style, ...signalStyle }} />;
});
