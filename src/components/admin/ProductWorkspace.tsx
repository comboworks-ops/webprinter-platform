import { WorkspaceValueBank, type WorkspaceBankItem } from './WorkspaceValueBank';
import { attachWorkspaceBankValue, bankSectionTypes, type BankValueType } from '@/lib/products/workspaceBankValue';
import { editWorkspacePlacement, restoreWorkspacePlacement, WORKSPACE_EDITOR_ACTION, WORKSPACE_EDITOR_STATE, type WorkspaceEditAction } from '@/lib/products/productWorkspaceEditing';
import { pictureModeSize, pictureModes, setWorkspaceGroupMode, patchWorkspaceSelectorStyle } from '@/lib/products/productOptionPresentation';
import { OptionSelectorStyleEditor } from './OptionSelectorStyleEditor';
import { ProductGalleryEditor } from './ProductGalleryEditor';
import { readProductGallery } from '@/lib/products/productGallery';
import { WorkspaceImageInput } from './WorkspaceImageInput';
import { ADMIN_WORKSPACE_EXIT_EVENT } from '@/lib/admin/workspaceExit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, Eye, Image, Monitor, Pencil, Plus, Save, Smartphone, Undo2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useProductAttributes } from '@/hooks/useProductAttributes';
import { getOrderFlowOptions, resolveOrderFlowDesign } from '@/lib/branding/orderFlowDesigns';
import { PRODUCT_PRICING_PREVIEW_UPDATE } from '@/lib/preview/productPricingPreview';
import { liveWorkspaceStructure, moveWorkspaceOption, patchWorkspaceSection, readWorkspaceDraft, sectionId, setWorkspaceMatrixAxis, validateWorkspace, workspaceGroups, workspaceSections, type WorkspaceGroup, type WorkspaceStructure } from '@/lib/products/productWorkspace';
import { saveProductWorkspace } from '@/lib/products/saveProductWorkspace';
import '@/styles/productWorkspace.css';

const modes = [['buttons', 'Knapper'], ['dropdown', 'Dropdown'], ['small', 'Små billedvalg'], ['medium', 'Mellemstore billedvalg'], ['large', 'Store billedvalg'], ['xl', 'Ekstra store billedvalg'], ['xl_notext', 'Store billeder uden tekst'], ['text_only', 'Kun tekst'], ['image_only', 'Kun billeder'], ['text_below_image', 'Tekst under billede'], ['checkboxes', 'Radiovalg'], ['hidden', 'Skjult']] as const;
type Product = { id: string; tenant_id: string; slug: string; name: string; description?: string; image_url?: string; is_published?: boolean; pricing_structure: WorkspaceStructure };
export function ProductWorkspace({ product, onProductSaved, embedded = false }: { embedded?: boolean; product: Product; onProductSaved: (structure: WorkspaceStructure, content?: Record<string, string>) => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { groups: sources, loading, createGroup, addValue } = useProductAttributes(product.id, product.tenant_id);
  const [expected, setExpected] = useState(product.pricing_structure);
  const [draft, setDraft] = useState(() => readWorkspaceDraft(product.pricing_structure).structure);
  const [savedDraft, setSavedDraft] = useState(() => JSON.stringify(readWorkspaceDraft(product.pricing_structure).structure));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [view, setView] = useState<'page' | 'card'>('page');
  const [designContext, setDesignContext] = useState<'published' | 'draft'>('published');
  const [designs, setDesigns] = useState<{ published?: any; draft?: any }>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [ready, setReady] = useState(false);
  const [editPreview, setEditPreview] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const [bankAdding, setBankAdding] = useState(false);
  const [bankType, setBankType] = useState<BankValueType>('format');
  const [bankBusy, setBankBusy] = useState(false);
  const bankBusyRef = useRef(false);
  const [placementUndo, setPlacementUndo] = useState<WorkspaceStructure | null>(null);
  const [moveNotice, setMoveNotice] = useState('');
  const inspector = useRef<HTMLElement>(null);
  const dirty = JSON.stringify(draft) !== savedDraft;
  const names = useMemo(() => Object.fromEntries(sources.map(group => [group.id, group.name])), [sources]);
  const values = useMemo(() => Object.fromEntries(sources.flatMap(group => (group.values || []).map(value => [value.id, value]))), [sources]);
  const sections = workspaceSections(draft);
  const groups = workspaceGroups(draft, names);
  const active = groups.find(group => group.id === expanded);
  const activeOption = active?.options.find(option => option.valueId === selectedValue);
  const bankOpen = !!activeOption || bankAdding;
  const sourceSection = sections.find(section => sectionId(section) === (activeOption?.sectionId || active?.options[0]?.sectionId || active?.id));
  const optionSetting = sourceSection?.valueSettings?.[activeOption?.valueId || ''] || {};
  const activeBranding = designs[designContext] || designs.published;
  const designId = resolveOrderFlowDesign('calculator', activeBranding);
  const layoutName = getOrderFlowOptions('calculator').find(option => option.id === designId)?.name;
  const stale = readWorkspaceDraft(expected).stale;
  const sourceLabel = (id: string) => { const section = sections.find(item => sectionId(item) === id); return section?.title || names[section?.groupId] || 'Valg'; };
  const contextPath = (path: string) => `${path}${location.search}`;
  const changeGroups = (next: WorkspaceGroup[]) => setDraft(current => ({ ...current, workspaceGroups: next, customerSelectionOrder: [...new Set(next.flatMap(group => group.options.map(option => option.sectionId)))] }));
  const changeGroup = (patch: Partial<WorkspaceGroup>) => setDraft(current => {
    let next = { ...current, workspaceGroups: workspaceGroups(current, names).map(group => group.id === expanded ? { ...group, ...patch } : group) };
    if (expanded && workspaceSections(current).some(section => sectionId(section) === expanded)) {
      const shared = { ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.uiMode !== undefined ? { ui_mode: patch.uiMode } : {}) };
      next = patchWorkspaceSection(next, expanded, shared) as typeof next;
    }
    if (expanded && patch.uiMode !== undefined) next = setWorkspaceGroupMode(next, expanded, patch.uiMode) as typeof next;
    if (expanded && 'imageSizePx' in patch) {
      const mode = workspaceGroups(next).find(group => group.id === expanded)?.uiMode || 'medium';
      next = setWorkspaceGroupMode(next, expanded, mode) as typeof next;
      next.workspaceGroups = next.workspaceGroups.map(group => group.id === expanded ? { ...group, imageSizePx: patch.imageSizePx } : group);
    }
    return next;
  });
  const editValue = (key: string, value: unknown) => {
    if (!activeOption || !sourceSection) return;
    setDraft(current => patchWorkspaceSection(current, activeOption.sectionId, { valueSettings: { ...sourceSection.valueSettings, [activeOption.valueId]: { ...optionSetting, ...(key === "customImage" ? { showThumbnail: true, preferCustomImage: true } : {}), [key]: value } } }));
  };
  const editPlacement = useCallback((action: WorkspaceEditAction) => {
    try {
      const next = editWorkspacePlacement(draft, action);
      if (next !== draft) { setPlacementUndo(draft); setDraft(next); setMoveNotice('Placeringen er opdateret i kladden.'); }
    } catch (error) { toast.error((error as Error).message); }
  }, [draft]);
  const selectGroup = useCallback((id: string, valueId?: string, focusInspector = true) => {
    setSearch(''); setExpanded(id); setSelectedValue(valueId || null); setBankAdding(false);
    inspector.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (focusInspector && window.matchMedia('(max-width: 800px)').matches) inspector.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, []);
  useEffect(() => {
    if (!sources.length || draft.workspaceGroups) return;
    const initialized = { ...draft, workspaceGroups: workspaceGroups(draft, names) };
    setDraft(initialized); setSavedDraft(JSON.stringify(initialized));
  }, [sources, draft, names]);
  useEffect(() => {
    let current = true;
    const refreshDesigns = () => supabase.from('tenants').select('settings').eq('id', product.tenant_id).single().then(({ data, error }) => {
      if (!current) return;
      if (error) { setStatus('Kunne ikke hente Site Design. Prøv at genindlæse.'); return; }
      const branding = (data as any)?.settings?.branding || {};
      setDesigns({ published: branding.published || branding, draft: branding.draft });
    });
    refreshDesigns();
    window.addEventListener('focus', refreshDesigns);
    return () => { current = false; window.removeEventListener('focus', refreshDesigns); };
  }, [product.tenant_id]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const intercept = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (link && link.target !== '_blank' && !frame.current?.contains(link) && !window.confirm('Du har ugemte ændringer. Forlad produktet?')) { event.preventDefault(); event.stopPropagation(); }
    };
    const shellExit = (event: Event) => { if (!window.confirm('Du har ugemte ændringer. Forlad produktet?')) event.preventDefault(); };
    window.addEventListener(ADMIN_WORKSPACE_EXIT_EVENT, shellExit);
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('click', intercept, true);
    return () => { window.removeEventListener(ADMIN_WORKSPACE_EXIT_EVENT, shellExit); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', intercept, true); };
  }, [dirty]);
  const sendPreview = useCallback(() => {
    const target = frame.current?.contentWindow;
    target?.postMessage({ type: PRODUCT_PRICING_PREVIEW_UPDATE, productId: product.id, pricingStructure: draft, isDirty: true }, window.location.origin);
    if (activeBranding) target?.postMessage({ type: 'BRANDING_UPDATE', branding: activeBranding }, window.location.origin);
    target?.postMessage({ type: 'SET_EDIT_MODE', enabled: editPreview }, window.location.origin);
    target?.postMessage({ type: WORKSPACE_EDITOR_STATE, productId: product.id, sourceGroups: loading ? undefined : sources, selectedId: expanded, groups: workspaceGroups(draft, names).map(group => ({ id: group.id, title: group.title, options: group.options, matrix: group.id === sectionId(draft.vertical_axis) || group.options.some(option => option.sectionId === sectionId(draft.vertical_axis)) })) }, window.location.origin);
  }, [draft, product.id, activeBranding, editPreview, expanded, names, sources, loading]);
  useEffect(() => { if (ready) sendPreview(); }, [ready, sendPreview]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'WORKSPACE_PREVIEW_HEIGHT' && event.data.productId === product.id && Number.isFinite(event.data.height) && frame.current) {
        frame.current.style.height = `${Math.max(610, Math.min(30000, Math.ceil(event.data.height)))}px`;
      }
      if (event.data?.type === 'PREVIEW_READY') { setReady(true); sendPreview(); }
      if (editPreview && event.data?.type === WORKSPACE_EDITOR_ACTION && event.data.productId === product.id) {
        const action = event.data as WorkspaceEditAction;
        if (groups.some(group => group.id === action.groupId)) {
          selectGroup(action.groupId, action.valueId, ['select', 'add'].includes(action.action));
          if (action.action === 'add') setBankAdding(true);
          else if (action.action !== 'select') editPlacement(action);
        }
      }
      if (editPreview && ['EDIT_SECTION', 'ELEMENT_CLICKED', 'SITE_DESIGN_TARGET_SELECTED'].includes(event.data?.type)) {
        const target = String(event.data.sectionId || event.data.targetId || '');
        const found = groups.find(group => group.options.some(option => target.includes(option.sectionId)));
        if (found) selectGroup(found.id, found.options.find(option => target.includes(option.valueId))?.valueId);
      }
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [sendPreview, groups, editPreview, product.id, editPlacement, selectGroup]);
  const chooseBankValue = async (item: WorkspaceBankItem, type: BankValueType) => {
    if (!active || bankBusyRef.current || loading) return;
    const group = active;
    const sourceId = sourceSection ? sectionId(sourceSection) : group.id;
    const replaceValueId = bankAdding ? undefined : activeOption?.valueId;
    bankBusyRef.current = true; setBankBusy(true);
    try {
      const kind = type === 'product' ? 'other' : type;
      let source = sources.find(item => item.id === sourceSection?.groupId);
      if (sourceSection?.groupId && !source) throw new Error('Sektionens prisgruppe kunne ikke hentes. Prøv igen.');
      if (!source) {
        source = await createGroup({ name: group.title, kind, ui_mode: 'buttons', source: 'product', sort_order: sources.length, enabled: true, library_group_id: null }) || undefined;
        if (!source) return;
      }
      const existing = source.values?.find(value => value.meta?.library_template_id === item.id || (value.enabled && value.name === item.name && (value.width_mm || null) === (item.width_mm || null) && (value.height_mm || null) === (item.height_mm || null)));
      if (existing && group.options.some(option => option.valueId === existing.id && option.sectionId === sourceId)) {
        selectGroup(group.id, existing.id); toast.info('Valget findes allerede i sektionen.'); return;
      }
      const value = existing || await addValue(source.id, { name: item.name, key: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), enabled: true, sort_order: source.values?.length || 0,
        width_mm: type === 'format' ? item.width_mm : null, height_mm: type === 'format' ? item.height_mm : null,
        meta: { library_template_id: item.id, ...(item.image_url ? { image: item.image_url } : {}), ...(item.icon_name ? { icon: item.icon_name } : {}), ...(type === 'format' ? { bleed_mm: item.bleed_mm ?? 3, safe_area_mm: item.safe_area_mm ?? 3 } : {}) },
      });
      if (!value) return;
      setDraft(current => attachWorkspaceBankValue(current, { groupId: group.id, sourceId, sourceGroupId: source.id, valueId: value.id, type, replaceValueId }));
      setSelectedValue(value.id); setPlacementUndo(null); setBankAdding(false);
      toast.success('Valget er tilføjet til kladden. Kontrollér priserne under Priser.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Valget kunne ikke tilføjes.'); }
    finally { bankBusyRef.current = false; setBankBusy(false); }
  };
  const save = async (publish = false) => {
    setSaving(true); setStatus('');
    try {
      const saved = await saveProductWorkspace(supabase, product.tenant_id, product.id, expected, draft, publish, product);
      setExpected(saved); setSavedDraft(JSON.stringify(draft)); onProductSaved(saved, publish ? Object.fromEntries(['name', 'description', 'image_url'].filter(key => typeof draft.workspaceContent?.[key] === 'string').map(key => [key, draft.workspaceContent[key]])) : undefined);
      const message = publish ? (product.is_published ? 'Bestillingsformen er opdateret i shoppen.' : 'Bestillingsformen er anvendt. Produktet er stadig upubliceret.') : 'Kladde gemt. Shoppen er uændret.';
      setStatus(''); toast.success(message);
    } catch (error) { const message = error instanceof Error ? error.message : 'Kunne ikke gemme.'; setStatus(message); toast.error(message); }
    finally { setSaving(false); }
  };
  const leave = (hash?: string) => { if (!dirty || window.confirm('Du har ugemte ændringer. Forlad produktet?')) navigate(hash ? `${location.pathname}${location.search}#${hash}` : contextPath('/admin/products')); };
  const previewParams = new URLSearchParams(location.search);
  previewParams.set('tenantId', product.tenant_id); previewParams.set('page', `/produkt/${product.slug}`);
  previewParams.set('editor', 'site-design-v2'); previewParams.set('productWorkspace', view); previewParams.set('preview_mode', '1');
  const previewUrl = `/preview-shop?${previewParams}`;
  const issues = validateWorkspace(draft);

  return <div className="product-workspace">
    {!embedded && <button type="button" className="pw-back" onClick={() => leave()}><ArrowLeft size={16} />Find produkter</button>}
    <header className="pw-heading"><div>{embedded ? <h2 className="text-xl font-semibold">Rediger produktsiden</h2> : <h1>{draft.workspaceContent?.name || product.name}</h1>}<p>Formater, materialer og udseende samlet ét sted <span className="pw-state">{dirty ? 'Ugemte ændringer' : expected.workspaceDraft ? 'Gemt kladde' : product.is_published ? 'Publiceret produkt' : 'Kladdeprodukt'}</span></p></div>
      <div className="pw-actions"><Button variant="ghost" onClick={() => leave('produkt')}>Priser</Button><Button variant="outline" disabled={saving} onClick={() => save()}><Save size={16} />Gem kladde</Button><Button disabled={saving || issues.length > 0} onClick={() => save(true)}>{saving ? 'Gemmer…' : 'Anvend i shop'}</Button></div>
    </header>
    {(status || stale || issues.length > 0) && <p className="pw-notice" role="status">{status || (issues.length ? issues.join(' ') : '') || 'Prisgrundlaget er ændret siden den gemte kladde. Den aktuelle version er åbnet; kladden er bevaret, indtil du gemmer igen.'}</p>}
    <div className={`pw-layout pw-canvas-layout ${editPreview ? 'is-editing' : 'is-previewing'}`}>
      {editPreview && <aside ref={inspector} className="pw-inspector" aria-label="Produktets opbygning">
        <section className="pw-box pw-options">
          <div className="pw-inspector-heading"><h2>{active ? active.title : 'Produktets sektioner'}</h2>{active && <button type="button" onClick={() => { setExpanded(null); setSelectedValue(null); }}><ArrowLeft size={14} />Alle sektioner</button>}</div>
          <p>{active ? bankOpen ? 'Vælg format eller materiale til det markerede valg.' : 'Rediger sektionens tekst, udseende og synlighed.' : 'Klik på et valg for at redigere. Hold og træk for at ændre rækkefølgen.'}</p>
          {!active && <><input aria-label="Find et valg" placeholder="Find format, papir eller tilvalg…" value={search} onChange={event => setSearch(event.target.value)} />
            <div className="pw-section-index">{groups.filter(group => !search || `${group.title} ${group.options.map(option => values[option.valueId]?.name).join(' ')}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(group => {
              const native = sections.find(section => sectionId(section) === (group.options[0]?.sectionId || group.id));
              const matrix = group.options.some(option => option.sectionId === sectionId(draft.vertical_axis));
              return <button key={group.id} type="button" onClick={() => selectGroup(group.id)}><span>{group.title}<small>{group.options.length} valg{matrix ? ' · Pristabel' : (group.uiMode || native?.ui_mode) === 'hidden' ? ' · Skjult' : ''}</small></span><Pencil size={14} /></button>;
            })}</div></>}
          {loading && <p role="status">Henter produktets valg…</p>}
          {groups.filter(group => group.id === expanded).map(group => {
            const native = sections.find(section => sectionId(section) === (group.options[0]?.sectionId || group.id));
            const mode = group.uiMode || native?.ui_mode || 'buttons';
            return <div key={group.id} className="pw-group is-open">
              <div className="pw-group-body">
                {bankOpen && <>
                  <button type="button" className="pw-bank-back" onClick={() => selectGroup(group.id)}><ArrowLeft size={14} />Sektionens indstillinger</button>
                  <WorkspaceValueBank key={`${group.id}:${activeOption?.valueId || 'new'}:${bankType}`} type={(Object.entries(bankSectionTypes).find(([, sectionType]) => sectionType === (sourceSection || native)?.sectionType)?.[0] as BankValueType) || bankType}
                    selected={activeOption && values[activeOption.valueId] ? { id: activeOption.valueId, name: optionSetting.displayName || values[activeOption.valueId].name, sourceName: values[activeOption.valueId].name, libraryTemplateId: values[activeOption.valueId].meta?.library_template_id, width_mm: values[activeOption.valueId].width_mm, height_mm: values[activeOption.valueId].height_mm, image_url: optionSetting.customImage || values[activeOption.valueId].meta?.image } : undefined}
                    allowTypeChange={!native && !sourceSection} hasSelection={!!activeOption} adding={bankAdding} busy={bankBusy || loading} onTypeChange={setBankType} onAddingChange={setBankAdding}
                    onPick={item => chooseBankValue(item, (Object.entries(bankSectionTypes).find(([, sectionType]) => sectionType === (sourceSection || native)?.sectionType)?.[0] as BankValueType) || bankType)} />
                </>}
                {!bankOpen && <>
                <label>Sektionens navn<input value={group.title} onChange={event => changeGroup({ title: event.target.value })} /></label>
                <label>Vis som<select value={mode} onChange={event => changeGroup({ uiMode: event.target.value })}>{modes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                {pictureModes.includes(mode) && <label>Billedstørrelse · {pictureModeSize(mode, group.imageSizePx)} px<input type="range" aria-label="Sektionens billedstørrelse" min="32" max="480" step="4" value={pictureModeSize(mode, group.imageSizePx)} onChange={event => changeGroup({ imageSizePx: Number(event.target.value) })} /><small>Gælder hele sektionen. Navnet står under billedet.</small><button type="button" className="underline" onClick={() => changeGroup({ imageSizePx: undefined })}>Gendan billedstørrelse</button></label>}
                {native && ['formats', 'materials'].includes(native.sectionType) && <label>Placering<select value={sectionId(draft.vertical_axis) === sectionId(native) ? 'matrix' : 'selector'} onChange={event => {
                  try { if (event.target.value === 'matrix') setDraft(current => setWorkspaceMatrixAxis(current, sectionId(native))); else { const candidate = sections.find(section => sectionId(section) !== sectionId(native) && ['formats', 'materials'].includes(section.sectionType)); if (candidate) setDraft(current => setWorkspaceMatrixAxis(current, sectionId(candidate))); else toast.error('Der skal være ét format eller materiale som matrixrække.'); } } catch (error) { toast.error((error as Error).message); }
                }}><option value="selector">Valgfelt</option><option value="matrix">Matrixrække</option></select></label>}
                {native && !['formats', 'materials'].includes(native.sectionType) && <label>Kunden vælger<select value={native.selection_mode || 'required'} onChange={event => setDraft(current => patchWorkspaceSection(current, sectionId(native), { selection_mode: event.target.value }))}><option value="required">Ét valg er påkrævet</option><option value="optional">Valgfrit tilvalg</option><option value="free">Valg uden pristillæg</option></select></label>}
                {native && <label>Beskrivelse<textarea value={native.description || ''} onChange={event => setDraft(current => patchWorkspaceSection(current, sectionId(native), { description: event.target.value }))} /></label>}
                {native && <details className="pw-detail"><summary>Knapper, billeder og sektionsboks</summary><div className="pw-detail-content"><OptionSelectorStyleEditor hideIntro detachedLabels uiMode={mode} value={native.selectorStyling || {}} onChange={(value, reset) => setDraft(current => patchWorkspaceSelectorStyle(current, sectionId(native), value, reset))} /></div></details>}
                <details className="pw-detail"><summary>Effekter og udfoldning</summary><div className="pw-detail-content"><label>Effekt ved mus eller fokus<select value={group.motion || 'none'} onChange={event => changeGroup({ motion: event.target.value as WorkspaceGroup['motion'] })}><option value="none">Ingen</option><option value="lift">Løft let</option><option value="zoom">Forstør let</option><option value="bounce">Hop let</option><option value="liquid">Væskefyld (knapper)</option></select></label>
                <label className="pw-check"><input type="checkbox" checked={group.reveal || false} onChange={event => changeGroup({ reveal: event.target.checked })} />Fold valgene ud ved klik</label></div></details>
                <details open className="pw-detail"><summary>Valg og billeder · {group.options.length}{group.pending?.length ? ` + ${group.pending.length} nye` : ''}</summary><div className="pw-detail-content">
                <div className="pw-value-list">{group.options.map((option, index) => {
                  const label = sections.find(section => sectionId(section) === option.sectionId)?.valueSettings?.[option.valueId]?.displayName || values[option.valueId]?.name || option.valueId;
                  const value = values[option.valueId];
                  return <div className="pw-value-row" key={`${option.sectionId}:${option.valueId}`}>
                    <button type="button" aria-pressed={activeOption?.valueId === option.valueId} onClick={() => selectGroup(group.id, option.valueId)}><span>{label}{value?.width_mm && value?.height_mm ? <small>{value.width_mm} × {value.height_mm} mm</small> : null}</span>{activeOption?.valueId === option.valueId && <Check size={13} />}</button>
                    <button type="button" aria-label={`Flyt ${label} frem`} disabled={index === 0} onClick={() => editPlacement({ action: 'option-before', groupId: group.id, sectionId: option.sectionId, valueId: option.valueId, targetId: `${group.options[index - 1].sectionId}:${group.options[index - 1].valueId}` })}><ArrowUp size={13} /></button>
                    <button type="button" aria-label={`Flyt ${label} tilbage`} disabled={index === group.options.length - 1} onClick={() => editPlacement({ action: 'option-before', groupId: group.id, sectionId: option.sectionId, valueId: option.valueId, targetId: `${group.options[index + 1].sectionId}:${group.options[index + 1].valueId}` })}><ArrowDown size={13} /></button>
                  </div>;
                })}</div>
                {group.pending?.map(value => <p className="pw-pending" key={value.id}>{value.name} · Mangler prisgrundlag <button type="button" aria-label={`Fjern ${value.name}`} onClick={() => changeGroup({ pending: group.pending?.filter(item => item.id !== value.id) })}>×</button></p>)}
                <div className="pw-add"><input aria-label="Nyt valgs navn" placeholder="Nyt valg…" value={newValue} onChange={event => setNewValue(event.target.value)} /><button type="button" aria-label="Tilføj nyt valg" disabled={!newValue.trim()} onClick={() => { changeGroup({ pending: [...(group.pending || []), { id: crypto.randomUUID(), name: newValue.trim() }] }); setNewValue(''); }}><Plus size={16} /></button></div>
                {!!group.pending?.length && <small>Nye valg er foreløbige i kladden. Tilføj dem fra banken, og opret deres priser under Priser.</small>}
                </div></details>
                <button type="button" className="pw-bank-button" onClick={() => { setSelectedValue(group.options[0]?.valueId || null); setBankAdding(!group.options.length); }}>Åbn sektionens bank</button>
                </>}
                {bankOpen && activeOption && sourceSection && <details className="pw-detail"><summary>Valgets navn og billede</summary><div className="pw-detail-content">
                  <label>Navn hos kunden<input value={optionSetting.displayName ?? values[activeOption.valueId]?.name ?? ''} onChange={event => editValue('displayName', event.target.value)} /></label>
                {activeOption && sourceSection && <div className="pw-value-editor">
                  <label>Flyt til gruppe<select disabled={activeOption.sectionId === sectionId(draft.vertical_axis)} value={group.id} onChange={event => setDraft(current => moveWorkspaceOption(current, activeOption, event.target.value, names))}>{groups.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                  <small>{activeOption.sectionId === sectionId(draft.vertical_axis) ? "Vælg placeringen Valgfelt for at flytte disse valg. " : ""}Prisvalg: {sourceLabel(activeOption.sectionId)}. Valg fra samme kilde er fortsat ét samlet valg.</small>
                  <WorkspaceImageInput label="Billede" value={optionSetting.customImage || ''} tenantId={product.tenant_id} productId={product.id} onChange={url => editValue('customImage', url)} />
                  <WorkspaceImageInput label="Billede ved mus over" value={optionSetting.hoverImage || ''} tenantId={product.tenant_id} productId={product.id} onChange={url => editValue('hoverImage', url)} />
                  <label>Billedstørrelse · {optionSetting.imageSizePx || pictureModeSize(mode, group.imageSizePx)} px<input type="range" min="24" max="480" step="4" value={optionSetting.imageSizePx || pictureModeSize(mode, group.imageSizePx)} onChange={event => editValue('imageSizePx', Number(event.target.value))} /></label>
                  <label>Markering<select value={sourceSection.selectorStyling?.pictureButtons?.selectedEffect || 'outline'} onChange={event => setDraft(current => patchWorkspaceSection(current, activeOption.sectionId, { selectorStyling: { ...sourceSection.selectorStyling, pictureButtons: { ...sourceSection.selectorStyling?.pictureButtons, selectedEffect: event.target.value } } }))}><option value="outline">Kant</option><option value="fill">Farve</option><option value="ring">Ring</option><option value="none">Ingen</option></select></label>
                </div>}
                </div></details>}
              </div>
            </div>;
          })}
          <div className="pw-add"><input aria-label="Ny gruppes navn" value={newGroup} placeholder="Ny gruppe…" onChange={event => setNewGroup(event.target.value)} /><button type="button" aria-label="Opret gruppe" disabled={!newGroup.trim()} onClick={() => { const id = crypto.randomUUID(); changeGroups([...groups, { id, title: newGroup.trim(), options: [] }]); selectGroup(id); setNewGroup(''); }}><Plus size={18} /></button></div>
        </section>
        <section className="pw-box"><button type="button" className="pw-section-toggle" aria-expanded={showContent} onClick={() => setShowContent(!showContent)}><Image size={17} />Billeder og produkttekst<ChevronDown size={16} /></button>{showContent && <div className="pw-group-body">{[['name', 'Produktnavn'], ['description', 'Beskrivelse']].map(([key, label]) => <label key={key}>{label}<input value={draft.workspaceContent?.[key] ?? String(product[key as keyof Product] ?? '')} onChange={event => setDraft(current => ({ ...current, workspaceContent: { ...current.workspaceContent, [key]: event.target.value } }))} /></label>)}<WorkspaceImageInput label="Produktbillede" value={draft.workspaceContent?.image_url ?? product.image_url ?? ''} tenantId={product.tenant_id} productId={product.id} onChange={url => setDraft(current => ({ ...current, workspaceContent: { ...current.workspaceContent, image_url: url } }))} /><ProductGalleryEditor images={readProductGallery(draft.workspaceContent)} sections={sections.map(section => ({ id: sectionId(section), title: section.title || names[section.groupId] || section.labelOverride || 'Valg', values: (section.valueIds || []).map((id: string) => ({ id, name: section.valueSettings?.[id]?.displayName || values[id]?.name || id })) }))} tenantId={product.tenant_id} productId={product.id} onChange={gallery => setDraft(current => ({ ...current, workspaceContent: { ...current.workspaceContent, gallery } }))} /></div>}</section>
        <section className="pw-box"><h2>Trykmetode</h2><p>Digitaltryk og offset vises, når den valgte pris har en angivet produktionsmetode.</p><small>Et bestemt antal er ikke i sig selv en trykmetode.</small></section>
        <button type="button" className="pw-reset" onClick={() => { if (window.confirm('Nulstil visningen til den aktuelle bestillingsform? Kladden ændres først, når du gemmer.')) setDraft(liveWorkspaceStructure(expected)); }}><Undo2 size={14} />Nulstil til aktuel form</button>
      </aside>}
      <section className="pw-preview" aria-label="Kundens forhåndsvisning">
        <div className="pw-preview-toolbar">{embedded ? <strong className="text-sm">Produktside</strong> : <div className="pw-tabs"><button type="button" aria-pressed={view === 'card'} onClick={() => { setView('card'); setReady(false); }}>Produktkort</button><button type="button" aria-pressed={view === 'page'} onClick={() => { setView('page'); setReady(false); }}>Produktside</button></div>}<div className="pw-device"><button type="button" aria-label="Desktop" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={19} /></button><button type="button" aria-label="Mobil" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={18} /></button></div><label className="pw-design-context">Site Design<select aria-label="Designkontekst" value={designContext} onChange={event => setDesignContext(event.target.value as typeof designContext)}><option value="published">Publiceret design</option><option value="draft" disabled={!designs.draft}>Gemt designkladde</option></select></label></div>
        <div className="pw-preview-modebar">
          <div className="pw-preview-modes" role="group" aria-label="Tilstand for produktvisning">
            <button type="button" aria-pressed={editPreview} onClick={() => setEditPreview(true)}><Pencil size={15} aria-hidden="true" />Rediger</button>
            <button type="button" aria-pressed={!editPreview} onClick={() => setEditPreview(false)}><Eye size={15} aria-hidden="true" />Forhåndsvisning</button>
          </div>
          {editPreview ? <div className="pw-canvas-actions"><button type="button" disabled={!placementUndo} aria-label="Fortryd sidste flytning" onClick={() => { if (placementUndo) { setDraft(current => restoreWorkspacePlacement(current, placementUndo)); setPlacementUndo(null); setMoveNotice('Sidste flytning er fortrudt.'); } }}><Undo2 size={16} /></button></div> : <span>Afprøv kundens valg</span>}
        </div>
        {editPreview && <p className="pw-canvas-hint" role="status">{moveNotice || 'Titel: indstillinger · Knap: åbn bank · Træk for at flytte · + tilføjer valg'}</p>}
        <div className="pw-preview-description"><span>{layoutName || 'Shoplayout'} · følger <a href={contextPath('/admin/site-design-v2')} target="_blank" rel="noreferrer">Site Design</a></span>{!embedded && <button type="button" onClick={() => leave('about')}>Produktinformation</button>}</div>
        <div className={`pw-frame-shell ${device}`}><iframe ref={frame} key={previewUrl} src={previewUrl} title="Produktets rigtige kundeside" onLoad={sendPreview} /></div>
      </section>
    </div>
  </div>;
}
