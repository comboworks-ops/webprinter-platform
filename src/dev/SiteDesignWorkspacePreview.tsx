/** Local design review. Uses shared editor UI with a browser-only draft. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ExternalLink, Save } from 'lucide-react';
import { SiteDesignWorkspace, SiteDesignNavigation } from '@/components/admin/SiteDesignWorkspace';
import { SiteDesignPreviewFrame } from '@/components/admin/SiteDesignPreviewFrame';
import { PrintDesignPicker } from '@/components/admin/PrintDesignPicker';
import { OrderFlowDesignInspector } from '@/components/admin/OrderFlowDesignInspector';
import { SiteDesignHeroCopy } from '@/components/admin/SiteDesignHeroCopy';
import { Button } from '@/components/ui/button';
import { mergeBrandingWithDefaults } from '@/hooks/useBrandingDraft';
import { applyPrintDesignPreset, selectPrintDesignPreset, DEFAULT_PRINT_DESIGN_ID } from '@/lib/branding/printDesignPresets';
import { applyOrderFlowDesign } from '@/lib/branding/orderFlowDesigns';
import '@/index.css';

const storageKey = 'webprinter:site-design-review:v1';
const tenantId = '00000000-0000-0000-0000-000000000000';
const initialDraft = () => {
  const draft = applyPrintDesignPreset(mergeBrandingWithDefaults(), DEFAULT_PRINT_DESIGN_ID);
  return { ...draft, forside: { ...draft.forside, productsSection: { ...draft.forside.productsSection,
    featuredProductConfig: { ...draft.forside.productsSection.featuredProductConfig, enabled: true,
      productId: '6c546267-6585-4465-a4fe-857e3d343612', quantityPresets: [1, 5, 10, 25, 50] },
  } } };
};
const sections = [
  { id: 'theme', label: 'Shopdesign' },
  { id: 'order-flow', label: 'Bestillingsflow' },
  { id: 'banner', label: 'Forsidens banner' },
];

function readLocalDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (stored?.version === 1 && stored.draft && typeof stored.draft === 'object') return mergeBrandingWithDefaults(stored.draft);
  } catch { /* Start fresh if storage is unavailable or the local draft is invalid. */ }
  return initialDraft();
}

function SiteDesignWorkspacePreview() {
  const [savedDraft, setSavedDraft] = useState(readLocalDraft);
  const [draft, setDraft] = useState(savedDraft);
  const [section, setSection] = useState('theme');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState('/');
  const [navigation, setNavigation] = useState<{ id: number; type: 'path'; path: string } | null>(null);
  const [notice, setNotice] = useState('Lokal forhåndsvisning · Gemmes kun i denne browser');
  const changed = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const navigate = (path: string) => {
    const destination = path === '/produkt' ? '/produkt/aluminium' : path;
    setNavigation(previous => ({ id: (previous?.id || 0) + 1, type: 'path', path: destination }));
  };
  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, draft }));
      setSavedDraft(draft);
      setNotice('Gemt lokalt i denne browser');
    } catch { setNotice('Browseren kunne ikke gemme kladden. Prøv igen.'); }
  };
  return <div className="sd-local-review">
    <nav className="sd-local-review-bar" aria-label="Lokal designgennemgang">
      <a href={`/?tenantId=${tenantId}`}><ArrowLeft size={15} /> Til webshoppen</a>
      <span>Site Design · lokal prøve</span>
      <a href={`/admin/site-design-v2?tenantId=${tenantId}`}>Åbn den fulde editor <ExternalLink size={14} /></a>
    </nav>
    <SiteDesignWorkspace
      title="Site Design V2"
      description="Tilpas din webshop, og se ændringerne med det samme."
      status={changed ? 'Lokale ændringer · ikke gemt endnu' : notice}
      actions={<>
        <Button variant="ghost" onClick={() => { setDraft(savedDraft); setNotice('Tilbage til den lokalt gemte kladde'); }} disabled={!changed}>Fortryd</Button>
        <Button onClick={save}><Save size={15} className="mr-2" />Gem lokalt</Button>
      </>}
      moreActions={<Button variant="ghost" onClick={() => { setDraft(initialDraft()); setNotice('Standarddesign valgt'); }}>Gendan standarddesign</Button>}
      navigation={<SiteDesignNavigation currentPage={currentPage} activeSection={section} sections={sections}
        onNavigate={navigate} onSectionChange={next => { setSection(next); setInspectorOpen(true); if (next === 'banner') navigate('/'); }} />}
      inspectorTitle={sections.find(item => item.id === section)?.label || 'Shopdesign'}
      inspectorOpen={inspectorOpen} onInspectorClose={() => setInspectorOpen(false)} onInspectorOpen={() => setInspectorOpen(true)}
      inspector={section === 'theme'
        ? <PrintDesignPicker compact value={draft.themeId} onChange={id => { setDraft(current => selectPrintDesignPreset(current, id)); navigate('/'); }} />
        : section === 'order-flow'
          ? <OrderFlowDesignInspector branding={draft} onChange={(page, id) => setDraft(current => ({ ...current, ...applyOrderFlowDesign(current, page, id) }))} />
          : <SiteDesignHeroCopy hero={draft.hero} onChange={hero => setDraft(current => ({ ...current, hero }))} />}
    >
      <SiteDesignPreviewFrame presentation="workspace" branding={draft} tenantName="Webprinter"
        previewUrl={`/preview-shop?draft=1&preview_mode=1&tenantId=${tenantId}&editor=site-design-v2`}
        navigationRequest={navigation} onPreviewPathChange={setCurrentPage}
        previewProducts={[{ id: '6c546267-6585-4465-a4fe-857e3d343612', name: 'Aluminium Skilte', slug: 'aluminium' }]} />
    </SiteDesignWorkspace>
    <p className="sd-local-review-note">Prøv shopdesign, bestillingsflow og bannertekst her. Den fulde editor kræver login og indeholder også billeder, menu, farver og øvrige indstillinger.</p>
  </div>;
}

if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<SiteDesignWorkspacePreview />);
}
