/** Development-only review using the real editor and browser-local persistence. */
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SiteDesignEditorV2 } from '@/components/admin/SiteDesignEditorV2';
import { mergeBrandingWithDefaults } from '@/hooks/useBrandingDraft';
import { TENANT_CAPABILITIES, type BrandingStorageAdapter } from '@/lib/branding/types';
import { standardSiteDesign } from '@/lib/branding/siteDesignControls';
import { legacyButtonStyle } from '@/lib/branding/sharedButtons';
import '@/index.css';

const storageKey = 'webprinter:site-colors-review:v1';
function initial() {
  const draft = standardSiteDesign(mergeBrandingWithDefaults());
  const stale = { ...legacyButtonStyle(draft, 'cta'), bgColor: '#CC0077' };
  draft.themeSettings.sharedButtons = { version: 1, cta: stale, bank: [], overrides: { header: { role: 'cta', style: stale } } };
  return draft;
}
function load() {
  try { const raw = localStorage.getItem(storageKey); if (raw) return mergeBrandingWithDefaults(JSON.parse(raw)); } catch { /* Recover a malformed local review draft. */ }
  return initial();
}
const unavailable = async (): Promise<never> => { throw new Error('Denne gennemgang gemmer kun en lokal kladde. Åbn den normale editor for at publicere.'); };
const adapter: BrandingStorageAdapter = {
  mode: 'tenant', entityId: '00000000-0000-0000-0000-000000000000', entityName: 'Farvegennemgang · lokal kladde',
  loadDraft: async () => load(), loadPublished: async () => initial(),
  saveDraft: async data => { localStorage.setItem(storageKey, JSON.stringify(data)); },
  discardDraft: async () => initial(), resetToDefault: async () => initial(), publish: unavailable,
  loadHistory: async () => [], restoreVersion: unavailable,
  loadSavedDesigns: async () => [], saveDesign: unavailable, loadSavedDesign: unavailable, deleteSavedDesign: unavailable,
  uploadAsset: unavailable, deleteAsset: unavailable,
};
if (import.meta.env.DEV) {
  createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><TooltipProvider>
    <div className="bg-slate-900 px-4 py-2 text-sm text-white">Lokal farvegennemgang · Gem kladde gemmer kun i denne browser · Publicering er slået fra</div>
    <SiteDesignEditorV2 adapter={adapter} capabilities={{ ...TENANT_CAPABILITIES, canApplyMasterTemplate: false, canViewHistory: false, canRestoreHistory: false }} />
    <Toaster />
  </TooltipProvider></BrowserRouter></QueryClientProvider>);
}
