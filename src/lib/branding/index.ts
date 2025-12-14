/**
 * Shared Branding System
 * 
 * This module provides a unified branding editing system for both
 * Master (platform template) and Tenant (shop owner) contexts.
 * 
 * Usage:
 * 
 * // For Master Admin:
 * import { createMasterAdapter, MASTER_CAPABILITIES, useBrandingEditor } from '@/lib/branding';
 * const adapter = createMasterAdapter();
 * const editor = useBrandingEditor({ adapter, capabilities: MASTER_CAPABILITIES });
 * 
 * // For Tenant Admin:
 * import { createTenantAdapter, TENANT_CAPABILITIES, useBrandingEditor } from '@/lib/branding';
 * const adapter = createTenantAdapter(tenantId, tenantName);
 * const editor = useBrandingEditor({ adapter, capabilities: TENANT_CAPABILITIES });
 */

// Types
export {
    type BrandingData,
    type BrandingMode,
    type BrandingStorageAdapter,
    type BrandingHistoryEntry,
    type BrandingCapabilities,
    type BrandingEditorContext,
    type HeroSettings,
    type HeroImage,
    type HeroVideo,
    type HeroButton,
    type HeaderSettings,
    type HeaderScrollSettings,
    type HeaderDropdownMode,
    type HeaderNavItem,
    type HeaderCtaSettings,
    type HeaderStyleType,
    type HeaderHeightType,
    type HeaderAlignmentType,
    type FooterSettings,
    type FooterLinkItem,
    type FooterSocialSettings,
    type SocialPlatformSettings,
    type FooterStyleType,
    type FooterBackgroundType,
    DEFAULT_BRANDING,
    DEFAULT_HERO,
    DEFAULT_HEADER,
    DEFAULT_HEADER_SCROLL,
    DEFAULT_HEADER_CTA,
    DEFAULT_NAV_ITEMS,
    DEFAULT_FOOTER,
    DEFAULT_FOOTER_SOCIAL,
    DEFAULT_FOOTER_LINKS,
    MASTER_CAPABILITIES,
    TENANT_CAPABILITIES,
    mergeBrandingWithDefaults,
    brandingEquals,
} from './types';

// Additional hero types from useBrandingDraft
export {
    type HeroOverlaySettings,
    type HeroSlideshowSettings,
    type HeroVideoSettings,
    DEFAULT_OVERLAY,
    DEFAULT_SLIDESHOW,
    DEFAULT_VIDEO_SETTINGS,
} from '@/hooks/useBrandingDraft';

// Adapters
export { createTenantAdapter } from './tenant-adapter';
export { createMasterAdapter, loadMasterTemplate } from './master-adapter';

// Hook
export { useBrandingEditor, type UseBrandingEditorReturn } from './use-branding-editor';
