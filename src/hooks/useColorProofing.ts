/**
 * Protected soft-proof core. See .agent/workflows/soft-proof-protected.md.
 * Preview rasterization is display-only; it never changes Fabric artwork.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import { ProofingSettings, loadProofingSettings, saveProofingSettings, OUTPUT_PROFILES, SRGB_PROFILE_URL, fetchICCProfile } from '@/lib/color/iccProofing';
import { resolveColorProfile, type ResolvedColorProfile } from '@/lib/color/profileResolver';
import { computeProofPreviewGeometry, ProofRequestGate, type ProofPreviewBounds, type ProofPreviewGeometry, type ProofRequestTicket } from '@/lib/color/proofPreviewGeometry';
import { computeExportRasterScale } from '@/lib/designer/export/exportRasterScale';

const DEBOUNCE_MS = 160;

interface UseColorProofingOptions {
    fabricCanvas: fabric.Canvas | null;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
    canvasWidth: number;
    canvasHeight: number;
    docWidth: number;
    docHeight: number;
    pasteboardOffset: number;
    pixelsPerMm: number;
    maxTrimMm: number;
    tenantId?: string;
    profileContextKey?: string | null;
    viewportScale?: number;
    viewportWidth?: number;
    viewportHeight?: number;
    viewportOffsetX?: number;
    viewportOffsetY?: number;
    customProfileId?: string;
    customProfileName?: string;
    customProfileBytes?: ArrayBuffer | null;
    customProfileLoading?: boolean;
    customProfileError?: string | null;
    preferredProfile?: { id: string; sha256?: string } | null;
}

export interface CmykPixelResult {
    cmykData: Uint8Array;
    proofedImageData: ImageData;
    width: number;
    height: number;
}

interface PendingPreview {
    id: string;
    ticket: ProofRequestTicket;
    geometry: ProofPreviewGeometry;
}

export function useColorProofing({
    fabricCanvas, overlayCanvasRef, canvasWidth, canvasHeight, docWidth, docHeight,
    pasteboardOffset, pixelsPerMm, maxTrimMm, tenantId, profileContextKey,
    viewportScale, viewportWidth, viewportHeight, viewportOffsetX, viewportOffsetY,
    customProfileId, customProfileName, customProfileBytes, customProfileLoading = false,
    customProfileError, preferredProfile,
}: UseColorProofingOptions) {
    const [settings, setSettings] = useState<ProofingSettings>(() => {
        const saved = loadProofingSettings();
        return {
            ...saved,
            // Only standard choices may carry across documents. Product/tenant UUIDs cannot.
            outputProfileId: OUTPUT_PROFILES.some(p => p.id === saved.outputProfileId) ? saved.outputProfileId : 'fogra39',
            customProfileId: undefined, customProfileName: undefined, customProfileBytes: null,
        };
    });
    const [worker, setWorker] = useState<Worker | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const readyRef = useRef(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resolvedOutputProfile, setResolvedOutputProfile] = useState<ResolvedColorProfile | null>(null);
    const [expectedProfileSha256, setExpectedProfileSha256] = useState<string | undefined>();
    const [selectionRevision, setSelectionRevision] = useState(0);
    const [previewBounds, setPreviewBounds] = useState<ProofPreviewBounds | null>(null);
    const [previewResolutionLimited, setPreviewResolutionLimited] = useState(false);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [devicePixelRatio, setDevicePixelRatio] = useState(() => typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    const gateRef = useRef(new ProofRequestGate());
    const pendingPreviewRef = useRef<PendingPreview | null>(null);
    const interactionRef = useRef(false);
    const editingRef = useRef(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initProfileRef = useRef<{ revision: number; profile: ResolvedColorProfile } | null>(null);
    const exportCounterRef = useRef(0);
    const pendingExportsRef = useRef(new Map<string, { resolve: (result: CmykPixelResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
    const productContextRef = useRef<{ key: string; selectedProductId?: string; preferredKey?: string; userSelected?: boolean }>({ key: '' });

    const clearPreview = useCallback(() => {
        gateRef.current.invalidatePreview();
        pendingPreviewRef.current = null;
        setIsProcessing(false);
        setIsPreviewVisible(false);
        const overlay = overlayCanvasRef.current;
        if (overlay) overlay.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    }, [overlayCanvasRef]);

    // A product context owns its recommendation; a previous product's UUID must never leak.
    useEffect(() => {
        const key = `${tenantId || ''}:${profileContextKey || 'standalone'}`;
        const changedContext = productContextRef.current.key !== key;
        if (changedContext) productContextRef.current = { key };
        const preferredKey = preferredProfile ? `${preferredProfile.id}:${preferredProfile.sha256 || ''}` : undefined;
        const shouldSelectPreferred = Boolean(!productContextRef.current.userSelected && preferredProfile && productContextRef.current.preferredKey !== preferredKey);
        if (shouldSelectPreferred) {
            productContextRef.current.preferredKey = preferredKey;
            setExpectedProfileSha256(preferredProfile?.sha256?.toLowerCase());
        } else if (changedContext || !preferredProfile) {
            setExpectedProfileSha256(undefined);
        }
        const shouldSelectProduct = Boolean(!productContextRef.current.userSelected && !preferredProfile && customProfileId && !customProfileLoading
            && productContextRef.current.selectedProductId !== customProfileId);
        if (shouldSelectProduct) productContextRef.current.selectedProductId = customProfileId;
        setSettings(prev => ({
            ...prev,
            customProfileId, customProfileName, customProfileBytes: customProfileBytes || null,
            outputProfileId: shouldSelectPreferred ? preferredProfile!.id
                : shouldSelectProduct ? customProfileId!
                : changedContext && profileContextKey ? 'fogra39'
                : changedContext && !OUTPUT_PROFILES.some(p => p.id === prev.outputProfileId) ? 'fogra39'
                : prev.outputProfileId,
        }));
    }, [tenantId, profileContextKey, customProfileId, customProfileName, customProfileBytes, customProfileLoading, preferredProfile?.id, preferredProfile?.sha256]);

    useEffect(() => {
        const update = () => setDevicePixelRatio(window.devicePixelRatio || 1);
        const query = window.matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
        query.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => { query.removeEventListener('change', update); window.removeEventListener('resize', update); };
    }, [devicePixelRatio]);

    const resolveOutputProfile = useCallback(async (profileId = settings.outputProfileId): Promise<ResolvedColorProfile> => {
        if (customProfileLoading && !productContextRef.current.userSelected && !preferredProfile?.id) {
            throw new Error('Produktets farveprofil indlæses stadig. Prøv igen om et øjeblik.');
        }
        if (customProfileError && !productContextRef.current.userSelected && !preferredProfile?.id
            && (!customProfileId || profileId === customProfileId)) throw new Error(customProfileError);
        const profile = await resolveColorProfile({
            id: profileId,
            tenantId,
            productProfile: settings.customProfileId && settings.customProfileBytes ? {
                id: settings.customProfileId,
                name: settings.customProfileName || 'Produktets farveprofil',
                bytes: settings.customProfileBytes,
            } : undefined,
        });
        if (profileId === settings.outputProfileId && expectedProfileSha256 && profile.metadata.sha256.toLowerCase() !== expectedProfileSha256) {
            throw new Error('Farveprofilens indhold er ændret siden designet blev gemt. Vælg og godkend en profil igen før eksport.');
        }
        return profile;
    }, [settings.outputProfileId, settings.customProfileId, settings.customProfileName, settings.customProfileBytes, tenantId, customProfileLoading, customProfileError, customProfileId, expectedProfileSha256, preferredProfile?.id, selectionRevision]);

    useEffect(() => {
        const failWorker = (message: string) => {
            workerRef.current = null;
            readyRef.current = false;
            setIsReady(false);
            setError(message);
            clearPreview();
            for (const pending of pendingExportsRef.current.values()) { clearTimeout(pending.timer); pending.reject(new Error(message)); }
            pendingExportsRef.current.clear();
        };
        let newWorker: Worker;
        try {
            newWorker = new Worker(new URL('../workers/colorProofing.worker.ts', import.meta.url), { type: 'module' });
            newWorker.onmessage = ({ data: msg }) => {
                const pendingExport = pendingExportsRef.current.get(msg.id);
                if (pendingExport) {
                    clearTimeout(pendingExport.timer);
                    pendingExportsRef.current.delete(msg.id);
                    if (msg.type === 'cmyk-transformed') pendingExport.resolve(msg);
                    else pendingExport.reject(new Error(msg.error || 'CMYK-konvertering mislykkedes'));
                    return;
                }
                if (msg.type === 'ready') {
                    const initialized = initProfileRef.current;
                    if (!initialized || msg.profileRevision !== initialized.revision || !gateRef.current.isCurrentProfile(initialized.revision)) return;
                    readyRef.current = true;
                    setResolvedOutputProfile(initialized.profile);
                    setIsReady(true);
                    setError(null);
                    return;
                }
                const pending = pendingPreviewRef.current;
                if (msg.type === 'transformed') {
                    if (!pending || msg.id !== pending.id || msg.profileRevision !== pending.ticket.profileRevision
                        || !gateRef.current.accepts(pending.ticket) || interactionRef.current || editingRef.current) return;
                    const overlay = overlayCanvasRef.current;
                    if (!overlay || !msg.imageData) return;
                    // Backing pixels are the display-density pixels returned by LCMS. No resizing.
                    overlay.width = msg.imageData.width;
                    overlay.height = msg.imageData.height;
                    const ctx = overlay.getContext('2d');
                    if (!ctx) return;
                    ctx.putImageData(msg.imageData, 0, 0);
                    if (msg.gamutMask) {
                        const gamutCanvas = document.createElement('canvas');
                        gamutCanvas.width = msg.gamutMask.width;
                        gamutCanvas.height = msg.gamutMask.height;
                        gamutCanvas.getContext('2d')?.putImageData(msg.gamutMask, 0, 0);
                        ctx.drawImage(gamutCanvas, 0, 0); // Same pixel size, alpha composite only.
                    }
                    setPreviewBounds(pending.geometry.bounds);
                    setPreviewResolutionLimited(pending.geometry.resolutionLimited);
                    setIsProcessing(false);
                    setIsPreviewVisible(true);
                    setError(null);
                } else if (msg.type === 'error') {
                    const isInit = msg.id === `init-${initProfileRef.current?.revision}`;
                    const isPreview = pending && msg.id === pending.id && gateRef.current.accepts(pending.ticket);
                    if (isInit || isPreview) {
                        clearPreview();
                        setError(msg.error || 'Farvevisning mislykkedes');
                        if (isInit) { readyRef.current = false; setIsReady(false); }
                    }
                }
            };
            newWorker.onerror = () => failWorker('Farvemotoren kunne ikke køre. Genindlæs designeren.');
            newWorker.onmessageerror = () => failWorker('Farvemotoren returnerede et ugyldigt svar.');
            workerRef.current = newWorker;
            setWorker(newWorker);
        } catch {
            failWorker('Farvemotoren kunne ikke initialiseres.');
            return;
        }
        return () => {
            newWorker.terminate();
            workerRef.current = null;
            readyRef.current = false;
            for (const pending of pendingExportsRef.current.values()) { clearTimeout(pending.timer); pending.reject(new Error('Designeren blev lukket')); }
            pendingExportsRef.current.clear();
        };
    }, [clearPreview, overlayCanvasRef]);

    useEffect(() => {
        const revision = gateRef.current.nextProfile();
        readyRef.current = false;
        setIsReady(false);
        setResolvedOutputProfile(null);
        setError(null);
        clearPreview();
        initProfileRef.current = null;
        if (!worker || (customProfileLoading && !productContextRef.current.userSelected && !preferredProfile?.id)) return;
        let cancelled = false;
        void Promise.all([fetchICCProfile(SRGB_PROFILE_URL), resolveOutputProfile()]).then(([inputBytes, profile]) => {
            if (cancelled || !gateRef.current.isCurrentProfile(revision)) return;
            initProfileRef.current = { revision, profile };
            const outputBytes = profile.bytes.slice(0);
            worker.postMessage({ type: 'init', id: `init-${revision}`, profileRevision: revision, inputProfileData: inputBytes, outputProfileData: outputBytes }, [inputBytes, outputBytes]);
        }).catch(err => {
            if (!cancelled && gateRef.current.isCurrentProfile(revision)) setError(err instanceof Error ? err.message : 'Farveprofilen kunne ikke indlæses');
        });
        return () => { cancelled = true; };
    }, [worker, resolveOutputProfile, customProfileLoading, preferredProfile?.id, clearPreview]);

    const processCanvas = useCallback(() => {
        if (!fabricCanvas || !workerRef.current || !settings.enabled || !readyRef.current || interactionRef.current || editingRef.current) return;
        const ticket = gateRef.current.nextPreview();
        try {
            // Fabric exports through the active viewport. Crop in those same coordinates.
            const geometry = computeProofPreviewGeometry({
                docWidth, docHeight, pasteboardOffset,
                viewportTransform: fabricCanvas.viewportTransform || fabric.iMatrix,
                viewportWidth: viewportWidth || fabricCanvas.getWidth(),
                viewportHeight: viewportHeight || fabricCanvas.getHeight(),
                devicePixelRatio,
            });
            if (!geometry) { clearPreview(); setPreviewBounds(null); return; }
            const capture = fabricCanvas.toCanvasElement(geometry.multiplier, geometry.bounds);
            const ctx = capture.getContext('2d');
            if (!ctx) throw new Error('Forhåndsvisningen kunne ikke tegnes');
            const imageData = ctx.getImageData(0, 0, capture.width, capture.height);
            const id = `proof-${ticket.profileRevision}-${ticket.requestId}`;
            pendingPreviewRef.current = { id, ticket, geometry };
            setIsProcessing(true);
            workerRef.current.postMessage({ type: 'transform', id, profileRevision: ticket.profileRevision, imageData, showGamutWarning: settings.showGamutWarning, gamutWarningColor: settings.gamutWarningColor }, [imageData.data.buffer]);
        } catch (err) {
            clearPreview();
            setError(err instanceof Error ? err.message : 'Forhåndsvisningen kunne ikke tegnes');
        }
    }, [fabricCanvas, settings.enabled, settings.showGamutWarning, settings.gamutWarningColor, docWidth, docHeight, pasteboardOffset, viewportWidth, viewportHeight, devicePixelRatio, clearPreview]);

    const refreshProof = useCallback(() => {
        clearPreview();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(processCanvas, DEBOUNCE_MS);
    }, [processCanvas, clearPreview]);

    // Clear stale pixels before the browser paints a changed zoom/viewport.
    useLayoutEffect(() => {
        refreshProof();
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); clearPreview(); };
    }, [refreshProof, isReady, settings.enabled, viewportScale, viewportWidth, viewportHeight, viewportOffsetX, viewportOffsetY]);

    useEffect(() => {
        if (!fabricCanvas) return;
        const start = () => { interactionRef.current = true; clearPreview(); };
        const end = () => { interactionRef.current = false; refreshProof(); };
        const editingStart = () => { editingRef.current = true; clearPreview(); };
        const editingEnd = () => { editingRef.current = false; refreshProof(); };
        const textChanged = () => { clearPreview(); if (!editingRef.current) refreshProof(); };
        const listeners = {
            'mouse:down': start, 'object:moving': start, 'object:scaling': start, 'object:rotating': start,
            'mouse:up': end, 'object:modified': end, 'object:added': refreshProof, 'object:removed': refreshProof,
            'text:editing:entered': editingStart, 'text:editing:exited': editingEnd, 'text:changed': textChanged,
        };
        for (const [event, listener] of Object.entries(listeners)) fabricCanvas.on(event as any, listener);
        return () => {
            for (const [event, listener] of Object.entries(listeners)) fabricCanvas.off(event as any, listener);
            interactionRef.current = false;
            editingRef.current = false;
        };
    }, [fabricCanvas, refreshProof, clearPreview]);

    const updateSettings = useCallback((patch: Partial<ProofingSettings>) => {
        clearPreview();
        setSettings(prev => {
            const next = { ...prev, ...patch };
            // Persist built-ins only; tenant/product selections belong to this document context.
            saveProofingSettings({ ...next, outputProfileId: OUTPUT_PROFILES.some(p => p.id === next.outputProfileId) ? next.outputProfileId : 'fogra39', customProfileId: undefined, customProfileName: undefined, customProfileBytes: null });
            return next;
        });
    }, [clearPreview]);
    const setEnabled = useCallback((enabled: boolean) => updateSettings({ enabled }), [updateSettings]);
    const setOutputProfile = useCallback((outputProfileId: string) => {
        productContextRef.current.userSelected = true;
        setSelectionRevision(previous => previous + 1);
        setExpectedProfileSha256(undefined);
        updateSettings({ outputProfileId });
    }, [updateSettings]);
    const setShowGamutWarning = useCallback((showGamutWarning: boolean) => updateSettings({ showGamutWarning }), [updateSettings]);
    const setCustomProfile = useCallback((id: string | undefined, name: string | undefined, bytes: ArrayBuffer | null) => {
        updateSettings({ customProfileId: id, customProfileName: name, customProfileBytes: bytes });
    }, [updateSettings]);

    const transformPixelsToCMYK = useCallback(async (
        imageData: ImageData, profile?: ResolvedColorProfile, inputProfileUrl = SRGB_PROFILE_URL,
    ): Promise<CmykPixelResult> => {
        const selected = profile || await resolveOutputProfile();
        const inputBytes = await fetchICCProfile(inputProfileUrl);
        const outputBytes = selected.bytes.slice(0);
        const activeWorker = workerRef.current;
        if (!activeWorker) throw new Error('Farvemotoren er ikke klar');
        const id = `export-${++exportCounterRef.current}`;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingExportsRef.current.delete(id);
                reject(new Error('CMYK-konverteringen tog for lang tid. Prøv et mindre dokument.'));
            }, 120_000);
            pendingExportsRef.current.set(id, { resolve, reject, timer });
            try {
                // Preserve the caller's pixel buffer, which may still be used by another export step.
                const pixels = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
                activeWorker.postMessage({ type: 'transform-to-cmyk', id, imageData: pixels, inputProfileData: inputBytes, outputProfileData: outputBytes }, [pixels.data.buffer, inputBytes, outputBytes]);
            } catch (err) {
                clearTimeout(timer);
                pendingExportsRef.current.delete(id);
                reject(err instanceof Error ? err : new Error('CMYK-konverteringen kunne ikke starte'));
            }
        });
    }, [resolveOutputProfile]);

    const exportCMYK = useCallback(async (
        inputProfileUrl: string, _outputProfileUrl: string, _outputProfileBytes?: ArrayBuffer | null,
        cropRect?: { left: number; top: number; width: number; height: number },
    ): Promise<{ cmykData: Uint8Array; proofedRgbDataUrl: string; width: number; height: number }> => {
        if (!fabricCanvas) throw new Error('Designeren er ikke klar');
        const profile = await resolveOutputProfile();
        const { multiplier } = computeExportRasterScale(cropRect?.width ?? fabricCanvas.getWidth(), cropRect?.height ?? fabricCanvas.getHeight(), pixelsPerMm, maxTrimMm);
        const capture = fabricCanvas.toCanvasElement(multiplier, cropRect || {});
        const ctx = capture.getContext('2d');
        if (!ctx) throw new Error('Eksporten kunne ikke tegnes');
        const result = await transformPixelsToCMYK(ctx.getImageData(0, 0, capture.width, capture.height), profile, inputProfileUrl);
        const output = document.createElement('canvas');
        output.width = result.width;
        output.height = result.height;
        const outputCtx = output.getContext('2d');
        if (!outputCtx) throw new Error('Eksporten kunne ikke afsluttes');
        outputCtx.putImageData(result.proofedImageData, 0, 0);
        return { cmykData: result.cmykData, proofedRgbDataUrl: output.toDataURL('image/png'), width: result.width, height: result.height };
    }, [fabricCanvas, pixelsPerMm, maxTrimMm, resolveOutputProfile, transformPixelsToCMYK]);

    return {
        settings, isReady: isReady && resolvedOutputProfile?.id === settings.outputProfileId
            && (!customProfileLoading || productContextRef.current.userSelected || Boolean(preferredProfile?.id)),
        isProcessing, error, previewBounds, previewResolutionLimited, isPreviewVisible,
        resolvedOutputProfile, resolveOutputProfile, transformPixelsToCMYK,
        setEnabled, setOutputProfile, setShowGamutWarning, setCustomProfile, refreshProof,
        hasCustomProfile: Boolean(settings.customProfileId && settings.customProfileBytes), exportCMYK,
    };
}

export default useColorProofing;
