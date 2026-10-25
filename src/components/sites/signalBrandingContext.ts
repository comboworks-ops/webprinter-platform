import type { BrandingData } from '@/hooks/useBrandingDraft';
import { createContext, useContext } from 'react';
import { signalSettings, type SignalSettings } from '@/lib/branding/pvcbannerSettings';

type SignalPresentation = SignalSettings & {
  fullBranding?: BrandingData;
  previewMenu?: boolean;
  nativeLinks?: boolean;
  navigate?: (path: string) => void;
};
const SignalContext = createContext<SignalPresentation>(signalSettings());
export const SignalSettingsProvider = SignalContext.Provider;
export const useSignalBranding = () => useContext(SignalContext);
