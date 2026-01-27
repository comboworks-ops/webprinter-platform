/**
 * HeroEditor - Legacy alias for BannerEditor
 * 
 * This file is kept for backward compatibility.
 * The "Hero" section has been renamed to "Banner" in the UI.
 * All functionality is now in BannerEditor.tsx
 * 
 * @deprecated Use BannerEditor instead
 */

export { BannerEditor as HeroEditor, BannerEditor } from './BannerEditor';
export type { BannerButton, BannerOverlaySettings } from './BannerEditor';
