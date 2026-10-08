import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fabric } from 'fabric';
import { PDFDocument } from 'pdf-lib';
import { validateBrochurePdfPage, deduplicateBrochureIccProfiles } from '@/lib/designer/brochurePdf';
import { FileUp, Download, Save, Type, Square, ImagePlus, Undo2, Redo2, Trash2, Loader2, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import EditorCanvas, { type EditorCanvasRef, type SelectedObjectProps } from './EditorCanvas';
import BrochurePagesPanel from './BrochurePagesPanel';
import { brochureFacingPages, brochurePageObjects, brochureSpreadPreviewObjects, stripBrochurePreviewClip, pruneBrochurePdfAssets, createBrochureDocument, joinBrochureSpread, readBrochureDocument, unlinkBrochureSpread, validateBrochurePdfPageCount, type BrochureDocument, type BrochureArtworkObject } from '@/lib/designer/brochureDocument';
import { createProductionPdf } from '@/lib/designer/export/createProductionPdf';
import { preserveBrochureSerializationGeometry } from '@/lib/designer/brochureGeometry';
import { hideGuides, restoreGuides } from '@/lib/designer/export/hideExportGuides';
import { addProductionOutputIntent } from '@/lib/designer/export/productionPdfObjects';
import { resolveColorProfile } from '@/lib/color/profileResolver';
import { OUTPUT_PROFILES } from '@/lib/color/iccProofing';
import { safePdfDocumentOptions } from '@/lib/pdfDocumentOptions';
import { decodeDesignerSnapshot, encodeDesignerSnapshot, resolveDesignerSaveTenant, updateOwnedDesign } from '@/lib/designer/saveDesign';
import { supabase } from '@/integrations/supabase/client';
import { getSafeInternalPath } from '@/lib/designer/orderFlowNavigation';
import { readBrochureDraft, writeBrochureDraft, type BrochureDraftScope } from '@/lib/designer/brochureDraft';
import { assertBrochureCheckoutDocument } from '@/lib/designer/brochureProduct';
import { getSiteCheckoutDesignSignature, markSiteCheckoutDesignReady, readSiteCheckoutSession, writeSiteCheckoutSession } from '@/lib/checkout/siteCheckoutSession';
import { uploadCheckoutFile } from '@/lib/checkout/privateUploads';
import '@/styles/brochureDesigner.css';

const DISPLAY_DPI = 50.8;
const PX_PER_MM = DISPLAY_DPI / 25.4;
const PADDING = 100;
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const isSystemObject = (object: BrochureArtworkObject) => Boolean(object.__isDocumentBackground || object.__isGuide || object.__isGuideLabel || object.__isStaticFrame || object.__isPdfTemplate);

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Product-specific document shell, sharing the existing canvas and production exporter. */
export default function BrochureDesigner({ pageCount, embedded = false, initialSnapshot }: { pageCount: number; embedded?: boolean; initialSnapshot?: object }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(() => readBrochureDocument(initialSnapshot)
    || createBrochureDocument(pageCount, Number(params.get('widthMm')) || 210, Number(params.get('heightMm')) || 297, Number(params.get('bleedMm')) || 3));
  const documentRef = useRef(document);
  const [activePage, setActivePage] = useState(1);
  const [name, setName] = useState('Brochure');
  const [busy, setBusy] = useState(true);
  const busyRef = useRef(true);
  const [revision, setRevision] = useState(0);
  const [progress, setProgress] = useState('Åbner designfladen…');
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(!params.get('designId') || Boolean(initialSnapshot));
  const [localSaved, setLocalSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<SelectedObjectProps | null>(null);
  const [profileId, setProfileId] = useState('fogra39');
  const [zoom, setZoom] = useState(.75);
  const [zoomMode, setZoomMode] = useState('fit');
  const canvasArea = useRef<HTMLElement>(null);
  const editor = useRef<EditorCanvasRef>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const uploadPage = useRef<number | null>(null);
  const previousImport = useRef<BrochureDocument | null>(null);
  const loadedDesign = useRef<string | null>(null);
  const guideImage = useRef<{ url: string; hash: string; name: string; sourceUrl: string } | null>(null);
  const canvasChanged = useRef(false);
  const draftId = useRef(params.get('draftId') || crypto.randomUUID());
  const draftScope = useRef<BrochureDraftScope>({ tenantId: params.get('tenantId'), productId: params.get('productId'), pageCount: document.pageCount, widthMm: document.widthMm, heightMm: document.heightMm, bleedMm: document.bleedMm });
  const draftWrites = useRef(Promise.resolve());
  const durableDraft = useRef<{ document: BrochureDocument; settings: string } | null>(null);
  const draftWriteSequence = useRef(0);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const spread = document.spreads.find(s => s.left === activePage || s.right === activePage);
  const surfaceLeft = spread?.left || activePage;
  const surfaceKey = `${surfaceLeft}-${spread ? 'spread' : 'single'}-${revision}`;
  const surfaceWidthMm = document.widthMm * (spread ? 2 : 1);
  const canvasWidth = (surfaceWidthMm + document.bleedMm * 2) * PX_PER_MM + PADDING * 2;
  const canvasHeight = (document.heightMm + document.bleedMm * 2) * PX_PER_MM + PADDING * 2;
  useEffect(() => {
    const area = canvasArea.current;
    if (!area || zoomMode !== 'fit') return;
    const fit = () => {
      const style = getComputedStyle(area);
      const horizontal = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const vertical = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setZoom(Math.max(.1, Math.min(1, (area.clientWidth - horizontal) / canvasWidth, (area.clientHeight - vertical) / canvasHeight)));
    };
    fit(); const observer = new ResizeObserver(fit); observer.observe(area);
    return () => observer.disconnect();
  }, [canvasWidth, canvasHeight, zoomMode]);

  const commit = useCallback((next: BrochureDocument) => { documentRef.current = next; setDocument(next); }, []);
  const setWorking = useCallback((working: boolean) => { busyRef.current = working; setBusy(working); }, []);
  const saveLocalDraft = useCallback((current: BrochureDocument) => {
    const settings = JSON.stringify({ profileId, name });
    if (durableDraft.current?.document === current && durableDraft.current.settings === settings) {
      setLocalSaved(true);
      return Promise.resolve();
    }
    const sequence = ++draftWriteSequence.current;
    setLocalSaved(false);
    const draft = { version: 1 as const, scope: draftScope.current, document: current, profileId, name, updatedAt: new Date().toISOString() };
    const write = draftWrites.current.catch(() => undefined).then(() => writeBrochureDraft(draftId.current, draft));
    draftWrites.current = write;
    void write.then(() => {
      durableDraft.current = { document: current, settings };
      if (sequence === draftWriteSequence.current) setLocalSaved(true);
    }, failure => { if (sequence === draftWriteSequence.current) setError((failure as Error).message); });
    return write;
  }, [name, profileId]);
  const persist = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    if (!canvasChanged.current) return documentRef.current;
    const canvas = editor.current?.getCanvas();
    for(const object of canvas?.getObjects()||[])preserveBrochureSerializationGeometry(object);
    const snapshot = editor.current?.getJSON() as { objects?: BrochureArtworkObject[] } | undefined;
    if (!snapshot || !canvas || busyRef.current) return documentRef.current;
    const next = structuredClone(documentRef.current);
    const currentSpread = next.spreads.find(s => s.left === activePage || s.right === activePage);
    const objects = (snapshot.objects || []).filter(object => !isSystemObject(object)).map(stripBrochurePreviewClip);
    if (currentSpread) currentSpread.objects = objects;
    else next.pages[activePage - 1].objects = objects;
    const hidden = hideGuides(canvas);
    const viewport = canvas.viewportTransform?.slice();
    try {
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      for (const number of currentSpread ? [currentSpread.left, currentSpread.right] : [activePage]) {
        next.pages[number - 1].thumbnail = canvas.toDataURL({ format: 'jpeg', quality: .7, multiplier: .3,
          left: PADDING + next.bleedMm * PX_PER_MM + (currentSpread?.right === number ? next.widthMm * PX_PER_MM : 0),
          top: PADDING + next.bleedMm * PX_PER_MM, width: next.widthMm * PX_PER_MM, height: next.heightMm * PX_PER_MM });
      }
    } finally { if (viewport) canvas.setViewportTransform(viewport); restoreGuides(hidden); }
    canvasChanged.current = false;
    commit(next);
    return next;
  }, [activePage, commit]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // An explicitly opened account design is authoritative. A local draft
        // is restored only for this UUID and its exact product/format scope.
        if (!params.get('designId') && !initialSnapshot) {
          const draft = await readBrochureDraft(draftId.current, draftScope.current);
          if (cancelled) return;
          if (draft) { durableDraft.current = { document: draft.document, settings: JSON.stringify({ profileId: draft.profileId, name: draft.name }) }; commit(draft.document); setName(draft.name); setProfileId(draft.profileId); setDirty(true); setLocalSaved(true); setRevision(n => n + 1); }
        }
        if (!cancelled) {
          if (!params.get('draftId')) { const next = new URLSearchParams(params); next.set('draftId', draftId.current); setParams(next, { replace: true }); }
          setDraftReady(true);
        }
      } catch (failure) { if (!cancelled) { setError((failure as Error).message); setLoadFailed(true); setDraftReady(true); setWorking(false); } }
    })();
    return () => { cancelled = true; };
    // The initial UUID and scope remain fixed through account saves and page switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draftReady && remoteReady && dirty && !loadFailed) void saveLocalDraft(document);
  }, [document, draftReady, remoteReady, dirty, loadFailed, saveLocalDraft]);

  useEffect(() => () => { clearTimeout(autosaveTimer.current); }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (busy || (dirty && !localSaved)) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [busy, dirty, localSaved]);

  useEffect(() => {
    const designId = params.get('designId');
    if (!designId || initialSnapshot || loadedDesign.current === designId) return;
    let cancelled = false;
    setWorking(true);
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Log ind for at åbne dit gemte design.');
        const { data, error: readError } = await supabase.from('designer_saved_designs').select('*').eq('id', designId).eq('user_id', user.id).single();
        if (readError || !data) throw new Error('Det gemte brochuredokument kunne ikke åbnes.');
        const snapshot = decodeDesignerSnapshot(data.editor_json as object);
        const restored = readBrochureDocument(snapshot);
        if (!restored) throw new Error('Designet er ikke en brochure.');
        if (cancelled) return;
        loadedDesign.current = designId; commit(restored); setName(data.name); setProfileId(data.color_profile || 'fogra39'); setRevision(n => n + 1); setDirty(false); setLoadFailed(false); setRemoteReady(true);
      } catch (failure) { if (!cancelled) { setError((failure as Error).message); setLoadFailed(true); setWorking(false); } }
    })();
    return () => { cancelled = true; };
  }, [commit, initialSnapshot, params, setWorking]);

  useEffect(() => {
    if (!draftReady || !remoteReady || loadFailed) return;
    let cancelled = false;
    setWorking(true);
    void (async () => {
      try {
        for (let attempt = 0; attempt < 120 && !editor.current?.getCanvas(); attempt++) await nextFrame();
        await nextFrame();
        if (cancelled || !editor.current?.getCanvas()) return;
        const current = documentRef.current;
        const currentSpread = current.spreads.find(s => s.left === activePage || s.right === activePage);
        const objects = currentSpread ? brochureSpreadPreviewObjects(current, currentSpread, PX_PER_MM, PADDING) : brochurePageObjects(current, activePage, PX_PER_MM);
        await editor.current.loadArtworkJSON({ version: fabric.version, objects });
        if (cancelled) return;
        const guideUrl = params.get('templatePdfUrl');
        const expectedHash = params.get('templatePdfSha256');
        if (guideUrl) {
          if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error('Brochureskabelonen mangler sit godkendte kontrolnummer.');
          if (guideImage.current?.sourceUrl !== guideUrl || guideImage.current?.hash !== expectedHash) {
            guideImage.current = null;
            const response = await fetch(guideUrl, { signal: AbortSignal.timeout(30000) });
            if (!response.ok) throw new Error('Brochureskabelonen kunne ikke hentes.');
            const bytes = await response.arrayBuffer();
            const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
            if (digest !== expectedHash) throw new Error('Brochureskabelonen matcher ikke den godkendte PDF.');
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
            const pdf = await pdfjs.getDocument(safePdfDocumentOptions({ data: bytes })).promise;
            try {
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 2 });
              if (Math.abs(viewport.width / 2 * 25.4 / 72 - current.widthMm - 2 * current.bleedMm) > .15 || Math.abs(viewport.height / 2 * 25.4 / 72 - current.heightMm - 2 * current.bleedMm) > .15) throw new Error('Brochureskabelonens størrelse passer ikke til de valgte sider.');
              const preview = window.document.createElement('canvas'); preview.width = Math.round(viewport.width); preview.height = Math.round(viewport.height);
              await page.render({ canvasContext: preview.getContext('2d')!, viewport }).promise;
              guideImage.current = { url: preview.toDataURL(), hash: digest, name: params.get('templatePdfName') || 'Brochureskabelon', sourceUrl: guideUrl };
            } finally { await pdf.destroy(); }
          }
          if (guideImage.current && !currentSpread) await editor.current.addPdfTemplate(guideImage.current.url, current.widthMm + 2 * current.bleedMm, current.heightMm + 2 * current.bleedMm,
            { sourceUrl: guideUrl, sha256: expectedHash, fileName: guideImage.current.name, pageIndex: 0 });
          if (currentSpread && guideImage.current) {
            // Each page gets its exact overlay at its own page origin. Both
            // are locked and excluded from customer JSON and all exports.
            const canvas = editor.current.getCanvas()!;
            for (const offset of [0, current.widthMm * PX_PER_MM]) {
              const image = await new Promise<fabric.Image>(resolve => fabric.Image.fromURL(guideImage.current!.url, resolve));
              image.set({ left: PADDING + offset, top: PADDING, scaleX: (current.widthMm + 2 * current.bleedMm) * PX_PER_MM / image.width!, scaleY: (current.heightMm + 2 * current.bleedMm) * PX_PER_MM / image.height!, opacity: .7, globalCompositeOperation: 'multiply', selectable: false, evented: false, excludeFromExport: true });
              Object.assign(image, { __isPdfTemplate: true, __isGuide: true }); canvas.add(image);
            }
            canvas.renderAll();
          }
        }
        if (!cancelled) { canvasChanged.current = false; setLoadFailed(false); setWorking(false); setProgress(''); }
      } catch (failure) { if (!cancelled) { setError((failure as Error).message); setLoadFailed(true); setWorking(false); } }
    })();
    return () => { cancelled = true; };
  }, [activePage, params, setWorking, surfaceKey, draftReady, remoteReady, loadFailed]);

  const selectPage = (number: number) => {
    if (busyRef.current || loadFailed) return;
    persist(); setProgress('Åbner siden…'); setActivePage(number); setSelected(null);
  };
  const changeSpread = (left: number, right?: number) => {
    const current = persist();
    commit(right ? joinBrochureSpread(current, left, right, PX_PER_MM) : unlinkBrochureSpread(current, left, PX_PER_MM));
    setActivePage(left); setRevision(n => n + 1); setDirty(true);
  };
  const importPdf = async (file: File) => {
    const current = persist();
    setWorking(true); setError(null); setProgress('Læser PDF…');
    try {
      const bytes = await file.arrayBuffer();
      const source = await PDFDocument.load(bytes);
      const targetPage = uploadPage.current;
      validateBrochurePdfPageCount(source.getPageCount(), current.pageCount, targetPage !== null);
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      const pdf = await pdfjs.getDocument(safePdfDocumentOptions({ data: bytes.slice(0) })).promise;
      let next = structuredClone(current);
      const assetId = crypto.randomUUID();
      next.pdfAssets = { ...next.pdfAssets, [assetId]: { bytes, pageCount: source.getPageCount(), fileName: file.name } };
      const targetSpread = targetPage && brochureFacingPages(targetPage, next.pageCount);
      if (targetSpread) next = unlinkBrochureSpread(next, targetSpread[0], PX_PER_MM);
      if (targetPage === null) next.spreads = [];
      try {
        for (let index = 0; index < source.getPageCount(); index++) {
          setProgress(`Fordeler side ${index + 1} af ${source.getPageCount()}…`);
          validateBrochurePdfPage(source, index);
          const page = await pdf.getPage(index + 1);
          const base = page.getViewport({ scale: 1 });
          const widthMm = base.width * 25.4 / 72, heightMm = base.height * 25.4 / 72;
          if (Math.abs(widthMm - current.widthMm - 2 * current.bleedMm) > .15 || Math.abs(heightMm - current.heightMm - 2 * current.bleedMm) > .15) {
            throw new Error(`PDF-side ${index + 1} er ${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm. Den skal være ${current.widthMm + 2 * current.bleedMm} × ${current.heightMm + 2 * current.bleedMm} mm inklusive udfald.`);
          }
          const viewport = page.getViewport({ scale: Math.min(2, 1400 / Math.max(base.width, base.height)) });
          const preview = window.document.createElement('canvas'); preview.width = Math.round(viewport.width); preview.height = Math.round(viewport.height);
          await page.render({ canvasContext: preview.getContext('2d')!, viewport }).promise;
          const thumbnail = window.document.createElement('canvas');
          const thumbnailScale = Math.min(1, 240 / Math.max(preview.width, preview.height));
          thumbnail.width = Math.max(1, Math.round(preview.width * thumbnailScale)); thumbnail.height = Math.max(1, Math.round(preview.height * thumbnailScale));
          thumbnail.getContext('2d')!.drawImage(preview, 0, 0, thumbnail.width, thumbnail.height);
          const number = targetPage ?? index + 1;
          next.pages[number - 1] = { number, thumbnail: thumbnail.toDataURL('image/jpeg', .75), objects: [{ type: 'image', version: fabric.version, src: preview.toDataURL('image/jpeg', .9),
            width: preview.width, height: preview.height, originX: 'center', originY: 'center',
            left: PADDING + (current.widthMm + 2 * current.bleedMm) * PX_PER_MM / 2,
            top: PADDING + (current.heightMm + 2 * current.bleedMm) * PX_PER_MM / 2,
            scaleX: widthMm * PX_PER_MM / preview.width, scaleY: heightMm * PX_PER_MM / preview.height,
            data: { kind: 'pdf_page_background', brochureBackgroundPage: number, brochurePdfAssetId: assetId, originalFileName: file.name, pageIndex: index, totalPages: source.getPageCount(),
              pdfWidthMm: widthMm, pdfHeightMm: heightMm, renderWidthPx: preview.width, renderHeightPx: preview.height } }] };
          thumbnail.width = 0; thumbnail.height = 0; preview.width = 0; preview.height = 0; page.cleanup();
        }
      } finally { await pdf.destroy(); }
      pruneBrochurePdfAssets(next);
      previousImport.current = current; commit(next); setRevision(n => n + 1); setDirty(true);
      toast.success(targetPage ? `Artwork lagt på side ${targetPage}` : `${next.pageCount} PDF-sider fordelt i brochuren`);
    } catch (failure) { setError((failure as Error).message); setWorking(false); }
    finally { if (pdfInput.current) pdfInput.current.value = ''; }
  };

  const save = async () => {
    if (loadFailed || (params.get('designId') && loadedDesign.current !== params.get('designId'))) { setError('Det eksisterende design skal åbnes korrekt, før du kan gemme.'); return; }
    const current = persist();
    setWorking(true); setError(null); setProgress('Gemmer alle sider…');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Log ind i en separat fane, og vend tilbage for at gemme. Dine sider bliver her.');
      const tenantId = await resolveDesignerSaveTenant(supabase, { embedded, queryTenantId: params.get('tenantId'), documentTenantId: params.get('tenantId'), productId: params.get('productId'), hostname: window.location.hostname, search: params.toString(), rootDomain: import.meta.env.VITE_ROOT_DOMAIN || 'webprinter.dk' });
      const data = { user_id: user.id, tenant_id: tenantId, name, width_mm: current.widthMm, height_mm: current.heightMm, bleed_mm: current.bleedMm, safe_area_mm: 3, dpi: 300, color_profile: profileId,
        product_id: params.get('productId'), template_id: params.get('templateId'), preview_thumbnail_url: null,
        editor_json: encodeDesignerSnapshot({ objects: current.pages[0].objects, brochureDocument: current, brochureContext: { profileId, templatePdfUrl: params.get('templatePdfUrl'), templatePdfSha256: params.get('templatePdfSha256'), returnTo: params.get('returnTo') } }) };
      const designId = params.get('designId');
      if (designId) await updateOwnedDesign(supabase, designId, user.id, tenantId, data);
      else {
        const { data: saved, error: saveError } = await supabase.from('designer_saved_designs').insert(data as never).select('id').single();
        if (saveError || !saved?.id) throw new Error('Brochuren blev ikke gemt. Behold fanen åben og prøv igen.');
        const next = new URLSearchParams(params); next.set('designId', saved.id); next.set('brochurePages', String(current.pageCount)); loadedDesign.current = saved.id; setParams(next, { replace: true });
      }
      setDirty(false); toast.success('Brochuren er gemt med alle sider og opslag');
    } catch (failure) { setError((failure as Error).message); }
    finally { setWorking(false); setProgress(''); }
  };

  const buildPdf = async (current: BrochureDocument) => {
      if (loadFailed) throw new Error('Designet og den valgte skabelon skal åbnes korrekt før eksport.');
      const guideUrl = params.get('templatePdfUrl');
      if (guideUrl && (guideImage.current?.sourceUrl !== guideUrl || guideImage.current?.hash !== params.get('templatePdfSha256'))) throw new Error('Den valgte brochureskabelon er ikke kontrolleret endnu.');
      const missing = current.pages.filter(page => !brochurePageObjects(current, page.number, PX_PER_MM).length);
      if (missing.length) throw new Error(`Der mangler artwork på side ${missing.map(p => p.number).join(', ')}. Upload eller design alle sider før eksport.`);
      const profile = await resolveColorProfile({ id: profileId, tenantId: params.get('tenantId') });
      const combined = await PDFDocument.create();
      const iccCache = new WeakMap();
      const warnings = new Set<string>();
      for (const page of current.pages) {
        setProgress(`Eksporterer side ${page.number} af ${current.pageCount}…`);
        const offscreen = new fabric.Canvas(window.document.createElement('canvas'), { width: (current.widthMm + 2 * current.bleedMm) * PX_PER_MM + PADDING * 2, height: canvasHeight, renderOnAddRemove: false });
        try {
          await new Promise<void>(resolve => offscreen.loadFromJSON({ version: fabric.version, objects: brochurePageObjects(current, page.number, PX_PER_MM) }, () => resolve()));
          for(const object of offscreen.getObjects())preserveBrochureSerializationGeometry(object);
          const trimLeft = PADDING + current.bleedMm * PX_PER_MM, trimTop = trimLeft;
          const trimRight = trimLeft + current.widthMm * PX_PER_MM, trimBottom = trimTop + current.heightMm * PX_PER_MM;
          const visibleArtwork = offscreen.getObjects().some(object => {
            if (object.visible === false || object.opacity === 0) return false;
            const bounds = object.getBoundingRect(true, true);
            return bounds.left < trimRight && bounds.left + bounds.width > trimLeft && bounds.top < trimBottom && bounds.top + bounds.height > trimTop;
          });
          if (!visibleArtwork) throw new Error(`Der mangler synligt artwork på side ${page.number}. Et opslag skal indeholde artwork på begge sider.`);
          const result = await createProductionPdf({ documentSpec: { name, width_mm: current.widthMm, height_mm: current.heightMm, bleed_mm: current.bleedMm, safe_area_mm: 3, dpi: 300, color_profile: profile.name },
            fabricCanvas: offscreen, includeBleed: true, displayMetrics: { mmToPx: PX_PER_MM, pasteboardPaddingPx: PADDING }, colorMode: 'convert_cmyk', outputProfile: profile });
          for (const warning of result.warnings) warnings.add(warning.message);
          const pdf = await PDFDocument.load(result.bytes);
          for (const copied of await combined.copyPages(pdf, [0])) combined.addPage(copied);
          await deduplicateBrochureIccProfiles(combined, iccCache);
        } finally { offscreen.dispose(); }
      }
      addProductionOutputIntent(combined, profile); combined.setTitle(name); combined.setCreator('Webprinter Designer');
      await deduplicateBrochureIccProfiles(combined, iccCache);
      const bytes = await combined.save();
      return { blob: new Blob([bytes.slice().buffer], { type: 'application/pdf' }), filename: `${name.replace(/[^\wæøåÆØÅ -]/g, '_')}.pdf`, warnings };
  };
  const exportPdf = async () => {
    const current = persist();
    setWorking(true); setError(null);
    try {
      const { blob, filename, warnings } = await buildPdf(current);
      download(blob, filename);
      if (warnings.size) toast.warning([...warnings].join(' '), { duration: 15000 });
      toast.success(`PDF eksporteret med ${current.pageCount} enkeltsider i rækkefølge`);
    } catch (failure) { setError((failure as Error).message); }
    finally { setWorking(false); setProgress(''); }
  };

  const returnToOrder = async () => {
    if (loadFailed) { setError('Den eksisterende kladde skal åbnes korrekt, før du kan gå videre.'); return; }
    const current = persist(), returnPath = getSafeInternalPath(params.get('returnTo'));
    if (!returnPath) return;
    setWorking(true); setError(null);
    try {
      await saveLocalDraft(current);
      if (params.get('order') !== '1') { navigate(returnPath); return; }
      const productId = params.get('productId'), state = readSiteCheckoutSession();
      assertBrochureCheckoutDocument(state, productId, current);
      const signature = getSiteCheckoutDesignSignature(state), checkoutInstanceId = state.checkoutInstanceId;
      const tenantId = await resolveDesignerSaveTenant(supabase, { embedded, queryTenantId: params.get('tenantId'), documentTenantId: params.get('tenantId'), productId,
        hostname: window.location.hostname, search: params.toString(), rootDomain: import.meta.env.VITE_ROOT_DOMAIN || 'webprinter.dk' });
      const { blob, filename, warnings } = await buildPdf(current);
      setProgress('Klargør brochurens trykfil…');
      const upload = await uploadCheckoutFile(supabase, tenantId, blob, filename, `order-files/${productId}-${crypto.randomUUID()}.pdf`);
      const latest = readSiteCheckoutSession();
      assertBrochureCheckoutDocument(latest, productId, current);
      if (latest.checkoutInstanceId !== checkoutInstanceId || getSiteCheckoutDesignSignature(latest) !== signature) throw new Error('Bestillingen er ændret. Behold brochuren her og vælg produktet igen.');
      const file = { name: filename, mimeType: 'application/pdf', sha256: upload.sha256, fileUrl: upload.url, filePath: upload.path, sourceMode: 'vector_pdf' as const };
      const next = { ...latest, proofApprovalRequired: true, designerExport: { ...file, previewDataUrl: current.pages[0].thumbnail || null,
        previewWidthMm: current.widthMm + current.bleedMm * 2, previewHeightMm: current.heightMm + current.bleedMm * 2, primaryFormat: 'pdf' as const, alternateFormats: [],
        productionFiles: [{ format: 'pdf' as const, ...file, isPrimary: true }], generatedAt: new Date().toISOString() } };
      if (!writeSiteCheckoutSession(next)) throw new Error('Bestillingen kunne ikke gemme trykfilen. Behold fanen åben og prøv igen.');
      markSiteCheckoutDesignReady(productId!, next);
      if (warnings.size) toast.warning([...warnings].join(' '), { duration: 15000 });
      navigate(returnPath);
    } catch (failure) { setError((failure as Error).message); }
    finally { setWorking(false); setProgress(''); }
  };

  return <div className="brochure-designer" data-brochure-page-count={document.pageCount}
    data-brochure-source-asset-count={Object.keys(document.pdfAssets || {}).length}
    data-brochure-source-bytes={Object.values(document.pdfAssets || {}).reduce((sum, asset) => sum + asset.bytes.byteLength, 0)}>
    <header className="brochure-header">
      <div className="brochure-title"><strong>{name}</strong><span>{document.widthMm} × {document.heightMm} mm · {document.pageCount} sider · Trådhæftet</span></div>
      <div className="brochure-actions">
        {getSafeInternalPath(params.get('returnTo')) && <Button variant="outline" disabled={busy || loadFailed} onClick={() => void returnToOrder()}>{params.get('order') === '1' ? 'Brug brochure til bestilling' : 'Tilbage'}</Button>}
        <Button variant="outline" disabled={busy || loadFailed} onClick={() => { uploadPage.current = null; pdfInput.current?.click(); }}><FileUp size={16} />Upload hele PDF'en</Button>
        <Button variant="outline" disabled={busy || loadFailed} onClick={() => void save()}><Save size={16} />Gem design</Button>
        <Button disabled={busy || loadFailed} onClick={() => void exportPdf()}><Download size={16} />Hent tryk-PDF</Button>
      </div>
    </header>
    {error && <div role="alert" className="brochure-error">{error}</div>}
    <div className="brochure-workspace">
      <BrochurePagesPanel document={document} activePage={activePage} busy={busy || loadFailed} onSelect={selectPage} onJoin={changeSpread} onUnlink={left => changeSpread(left)} onUploadPage={number => { uploadPage.current = number; pdfInput.current?.click(); }} />
      <div className="brochure-center">
        <div className="brochure-toolbar" aria-label="Designværktøjer">
          <Button variant="ghost" size="icon" aria-label="Vælg artwork" disabled={busy || loadFailed} onClick={() => editor.current?.getCanvas()?.discardActiveObject().renderAll()}><MousePointer2 size={18} /></Button>
          <Button variant="ghost" disabled={busy || loadFailed} onClick={() => editor.current?.addText()}><Type size={18} />Tekst</Button>
          <Button variant="ghost" disabled={busy || loadFailed} onClick={() => editor.current?.addRectangle()}><Square size={18} />Felt</Button>
          <Button variant="ghost" disabled={busy || loadFailed} onClick={() => imageInput.current?.click()}><ImagePlus size={18} />Billede</Button>
          <Button variant="ghost" size="icon" aria-label="Fortryd" disabled={busy || loadFailed} onClick={() => editor.current?.undo()}><Undo2 size={18} /></Button>
          <Button variant="ghost" size="icon" aria-label="Gentag" disabled={busy || loadFailed} onClick={() => editor.current?.redo()}><Redo2 size={18} /></Button>
          <Button variant="ghost" size="icon" aria-label="Slet valgte" disabled={busy || loadFailed || !selected} onClick={() => editor.current?.deleteSelected()}><Trash2 size={18} /></Button>
          {selected && <><EditableNumberInput aria-label="Tekststørrelse" type="number" min={6} max={300} value={selected.fontSize || 24} onChange={event => editor.current?.updateSelectedProps({ fontSize: Number(event.target.value) })} />
            <input aria-label="Farve" type="color" value={typeof selected.fill === 'string' && /^#[a-f0-9]{6}$/i.test(selected.fill) ? selected.fill : '#17212e'} onChange={event => editor.current?.updateSelectedProps({ fill: event.target.value })} /></>}
          <select disabled={busy || loadFailed} aria-label="Zoom" value={zoomMode} onChange={event => { setZoomMode(event.target.value); if (event.target.value !== 'fit') setZoom(Number(event.target.value)); }}><option value="fit">Tilpas</option>{[.25, .5, .75, 1, 1.5].map(value => <option key={value} value={value}>{value * 100}%</option>)}</select>
          <select disabled={busy || loadFailed} aria-label="Trykprofil" value={profileId} onChange={event => setProfileId(event.target.value)}>{OUTPUT_PROFILES.map(profile => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</select>
          {previousImport.current && <Button variant="ghost" disabled={busy || loadFailed} onClick={() => { const old = previousImport.current!; previousImport.current = null; commit(old); setRevision(n => n + 1); setDirty(true); }}>Fortryd PDF-import</Button>}
        </div>
        <main ref={canvasArea} className="brochure-canvas" aria-label={spread ? `Opslag ${spread.left}–${spread.right}` : `Side ${activePage}`}>
          <div className="brochure-canvas-frame" style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}>
            <EditorCanvas key={surfaceKey} ref={editor} width={surfaceWidthMm} height={document.heightMm} bleed={document.bleedMm} safeArea={3} displayDpi={DISPLAY_DPI} dpi={300} showPasteboardLegend={false}
              viewportWidth={canvasWidth * zoom} viewportHeight={canvasHeight * zoom} viewportScale={zoom} selectedTool="select"
              onSelectionChange={(_hasSelection, props) => setSelected(props || null)} onCanvasChange={() => { if (!busyRef.current && !loadFailed) { canvasChanged.current = true; setDirty(true); setLocalSaved(false); clearTimeout(autosaveTimer.current); autosaveTimer.current = setTimeout(() => { if (!busyRef.current) persist(); }, 1500); } }} />
            {spread && <div className="brochure-midline" aria-hidden="true" />}
          </div>
          {busy && <div className="brochure-loading" role="status"><Loader2 className="animate-spin mr-2" size={18} />{progress || 'Arbejder…'}</div>}
        </main>
      </div>
    </div>
    <footer className="brochure-status"><span>{spread ? `Opslag ${spread.left}–${spread.right}` : `Side ${activePage}`} · {document.bleedMm} mm udfald</span><span className="brochure-guide-key"><span><i className="brochure-trim-key" />Skærelinje</span><span><i className="brochure-safe-key" />Sikkerhedsafstand</span></span><span>{dirty ? (localSaved ? 'Kladde gemt på denne enhed' : 'Gemmer lokal kladde…') : 'Klar'}</span></footer>
    <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importPdf(file); }} />
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (!file) return; const url = URL.createObjectURL(file); void editor.current?.addImage(url).finally(() => URL.revokeObjectURL(url)); event.target.value = ''; }} />
  </div>;
}
