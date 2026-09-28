import { createContext, useContext } from 'react';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { resolveSharedButton, sharedButtonAttributes, type SharedButtonRole } from '@/lib/branding/sharedButtons';
import '@/styles/sharedButtons.css';

export const SharedButtonContext = createContext<Partial<BrandingData> | null>(null);
export function useSharedButtonStyles() {
  const branding = useContext(SharedButtonContext);
  return (role: SharedButtonRole, key?: string) => sharedButtonAttributes(resolveSharedButton(branding, role, key), role);
}
