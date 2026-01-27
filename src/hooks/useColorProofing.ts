/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        🔒 PROTECTED CORE FILE 🔒                          ║
 * ║                                                                           ║
 * ║  This file contains critical soft proofing functionality.                 ║
 * ║  DO NOT MODIFY without reviewing: /soft-proof-protected                   ║
 * ║                                                                           ║
 * ║  Last verified working: 2026-01-03                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * useColorProofing Hook
 * 
 * Manages color proofing state, worker communication, and overlay rendering.
 * Communicates with colorProofing.worker.ts for ICC-based color transformations.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import {
    ProofingSettings,
    loadProofingSettings,
    saveProofingSettings,
    OUTPUT_PROFILES,
    SRGB_PROFILE_URL,
} from '@/lib/color/iccProofing';
import { toast } from 'sonner';

// Debounce time for canvas updates (ms)
const DEBOUNCE_MS = 200;

// Max dimension for proofing preview (performance)
const MAX_PREVIEW_DIMENSION = 1000;

interface UseColorProofingOptions {
    fabricCanvas: fabric.Canvas | null;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
    canvasWidth: number;
    canvasHeight: number;
    // Document area dimensions (excluding pasteboard)
    docWidth: number;
    docHeight: number;
    pasteboardOffset: number;  // Offset from canvas edge to document area
    // Optional: Custom ICC profile data (per-product)
    customProfileId?: string;
    customProfileName?: string;
    customProfileBytes?: ArrayBuffer | null;
}

interface UseColorProofingReturn {
    settings: ProofingSettings;
    isProcessing: boolean;
    error: string | null;
    setEnabled: (enabled: boolean) => void;
    setOutputProfile: (profileId: string) => void;
    setShowGamutWarning: (show: boolean) => void;
    setCustomProfile: (id: string | undefined, name: string | undefined, bytes: ArrayBuffer | null) => void;
    refreshProof: () => void;
    hasCustomProfile: boolean;
    exportCMYK: (
        inputProfileUrl: string,
        outputProfileUrl: string,
        outputProfileBytes?: ArrayBuffer | null,
        cropRect?: { left: number; top: number; width: number; height: number }
    ) => Promise<{ cmykData: Uint8Array; proofedRgbDataUrl: string; width: number; height: number }>;
}

export function useColorProofing({
    fabricCanvas,
    overlayCanvasRef,
    canvasWidth,
    canvasHeight,
    docWidth,
    docHeight,
    pasteboardOffset,
    customProfileId,
    customProfileName,
    customProfileBytes,
}: UseColorProofingOptions): UseColorProofingReturn {
    const [settings, setSettings] = useState<ProofingSettings>(() => {
        const base = loadProofingSettings();
        return {
            ...base,
            customProfileId: undefined,
            customProfileName: undefined,
            customProfileBytes: null,
        };
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [isWorkerReady, setIsWorkerReady] = useState(false);

    const workerRef = useRef<Worker | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const messageIdRef = useRef(0);
    const lastProcessedRef = useRef<string>('');

    const [worker, setWorker] = useState<Worker | null>(null);

    // Sync props to settings
    useEffect(() => {
        if (customProfileId && customProfileBytes) {
            setSettings(prev => ({
                ...prev,
                customProfileId,
                customProfileName,
                customProfileBytes,
                // If the current profile is 'product' or matches this ID, ensure it's selected
                outputProfileId: (prev.outputProfileId === 'product' || prev.outputProfileId === customProfileId)
                    ? customProfileId
                    : prev.outputProfileId
            }));
        }
    }, [customProfileId, customProfileName, customProfileBytes]);

    // Create worker
    useEffect(() => {
        try {
            const newWorker = new Worker(
                new URL('../workers/colorProofing.worker.ts', import.meta.url),
                { type: 'module' }
            );

            newWorker.onmessage = (e) => {
                const msg = e.data;
                const id = msg.id;

                if (msg.type === 'ready') {
                    console.log('[Hook] Worker ready:', id);
                    setIsWorkerReady(true);
                    return;
                }

                if (msg.type === 'transformed') {
                    if (id !== lastProcessedRef.current) return;
                    setIsProcessing(false);
                    setError(null);

                    if (msg.imageData && overlayCanvasRef.current) {
                        const overlay = overlayCanvasRef.current;
                        const ctx = overlay.getContext('2d');
                        if (ctx) {
                            overlay.width = docWidth;
                            overlay.height = docHeight;
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = msg.imageData.width;
                            tempCanvas.height = msg.imageData.height;
                            const tempCtx = tempCanvas.getContext('2d');
                            if (tempCtx) {
                                tempCtx.putImageData(msg.imageData, 0, 0);
                                ctx.clearRect(0, 0, docWidth, docHeight);
                                ctx.drawImage(tempCanvas, 0, 0, docWidth, docHeight);

                                if (msg.gamutMask) {
                                    const gamutCanvas = document.createElement('canvas');
                                    gamutCanvas.width = msg.gamutMask.width;
                                    gamutCanvas.height = msg.gamutMask.height;
                                    const gamutCtx = gamutCanvas.getContext('2d');
                                    if (gamutCtx) {
                                        gamutCtx.putImageData(msg.gamutMask, 0, 0);
                                        ctx.drawImage(gamutCanvas, 0, 0, docWidth, docHeight);
                                    }
                                }
                            }
                        }
                    }
                } else if (msg.type === 'error') {
                    setIsProcessing(false);
                    setError(msg.error || 'Proofing error');
                    console.error('Color proofing error:', msg.error);
                }
            };

            newWorker.onerror = (e) => {
                console.error('Worker error:', e);
                setError('Worker runtime error');
            };

            setWorker(newWorker);
            workerRef.current = newWorker;

            return () => {
                newWorker.terminate();
                setWorker(null);
                workerRef.current = null;
                setIsWorkerReady(false);
            };
        } catch (err) {
            console.error('Failed to create worker:', err);
            setError('Could not initialize color proofing');
        }
    }, [canvasWidth, canvasHeight, overlayCanvasRef, docWidth, docHeight]);

    // Initialize worker profiles
    useEffect(() => {
        const initWorkerProfiles = async () => {
            if (!worker) return;
            try {
                setIsWorkerReady(false);
                setError('Indlæser farveprofiler...');
                const profile = OUTPUT_PROFILES.find(p => p.id === settings.outputProfileId) || OUTPUT_PROFILES[0];
                const now = Date.now();
                const [inputRes, outputRes] = await Promise.all([
                    fetch(`${SRGB_PROFILE_URL}?t=${now}`),
                    fetch(`${profile.url}?t=${now}`)
                ]);
                if (!inputRes.ok) throw new Error(`Kunne ikke hente sRGB profil`);
                if (!outputRes.ok) throw new Error(`Kunne ikke hente output profil`);
                const [inputBytes, outputBytes] = await Promise.all([
                    inputRes.arrayBuffer(),
                    (settings.customProfileId && settings.outputProfileId === settings.customProfileId && settings.customProfileBytes)
                        ? Promise.resolve(settings.customProfileBytes.slice(0))
                        : outputRes.arrayBuffer()
                ]);

                console.log(`[Hook] Profiles loaded: sRGB=${inputBytes.byteLength} bytes, Output=${outputBytes.byteLength} bytes`);
                if (inputBytes.byteLength === 0 || outputBytes.byteLength === 0) {
                    throw new Error(`Loaded profile is empty (sRGB: ${inputBytes.byteLength}, Output: ${outputBytes.byteLength})`);
                }

                worker.postMessage({
                    type: 'init',
                    id: 'init-profiles',
                    inputProfileData: inputBytes,
                    outputProfileData: outputBytes
                }, [inputBytes, outputBytes]);
                setError(null);
            } catch (err) {
                console.error('Failed to init profiling profiles:', err);
                setError(err instanceof Error ? err.message : 'Fejl ved indlæsning af farveprofiler');
                setIsWorkerReady(false);
            }
        };
        if (worker) initWorkerProfiles();
    }, [settings.outputProfileId, settings.customProfileBytes, SRGB_PROFILE_URL, worker]);

    // Proof object reference to track the Fabric image on canvas
    const proofObjectRef = useRef<fabric.Image | null>(null);

    // Clean up proof object when unmounting or disabling
    const clearProofObject = useCallback(() => {
        if (fabricCanvas && proofObjectRef.current) {
            fabricCanvas.remove(proofObjectRef.current);
            proofObjectRef.current = null;
            fabricCanvas.requestRenderAll();
        }
    }, [fabricCanvas]);

    // Capture and process canvas - only the document area (excluding pasteboard)
    const processCanvas = useCallback(async () => {
        if (!fabricCanvas || !workerRef.current || !settings.enabled || !isWorkerReady) {
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
            return;
        }

        try {
            // Use toDataURL to get a consistent snapshot of the document area, ignoring current viewport transform/zoom
            const dataUrl = fabricCanvas.toDataURL({
                format: 'png',
                left: pasteboardOffset,
                top: pasteboardOffset,
                width: docWidth,
                height: docHeight,
                multiplier: 1,
                withoutTransform: true
            });

            // Load into an image for processing
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });

            // Scale down if too large for preview performance
            let width = img.width;
            let height = img.height;
            if (width > MAX_PREVIEW_DIMENSION || height > MAX_PREVIEW_DIMENSION) {
                const scale = MAX_PREVIEW_DIMENSION / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }

            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');
            if (!ctx) throw new Error('Could not get canvas context');

            // Draw the captured document image
            ctx.drawImage(img, 0, 0, width, height);

            const imageData = ctx.getImageData(0, 0, width, height);
            const id = `transform-${++messageIdRef.current}`;
            lastProcessedRef.current = id;
            setIsProcessing(true);

            workerRef.current.postMessage({
                type: 'transform',
                id,
                imageData,
                showGamutWarning: settings.showGamutWarning,
                gamutWarningColor: '#00ff00',
            }, [imageData.data.buffer]);

        } catch (err) {
            console.error('Failed to process canvas:', err);
            setIsProcessing(false);
        }
    }, [fabricCanvas, settings, overlayCanvasRef, isWorkerReady, docWidth, docHeight, pasteboardOffset]);

    const refreshProof = useCallback(() => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(processCanvas, DEBOUNCE_MS);
    }, [processCanvas]);

    useEffect(() => {
        if (!fabricCanvas || !settings.enabled) {
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            }
            return;
        }
        const onInteractionStart = () => {
            setIsInteracting(true);
            if (overlayCanvasRef.current) overlayCanvasRef.current.style.opacity = '0';
        };
        const onInteractionEnd = () => {
            setIsInteracting(false);
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                overlayCanvasRef.current.style.opacity = '1';
            }
            refreshProof();
        };
        const onContentChanged = () => refreshProof();
        fabricCanvas.on('mouse:down', onInteractionStart);
        fabricCanvas.on('object:moving', onInteractionStart);
        fabricCanvas.on('object:scaling', onInteractionStart);
        fabricCanvas.on('object:rotating', onInteractionStart);
        fabricCanvas.on('mouse:up', onInteractionEnd);
        fabricCanvas.on('object:modified', onInteractionEnd);
        fabricCanvas.on('object:added', onContentChanged);
        fabricCanvas.on('object:removed', onContentChanged);
        refreshProof();
        return () => {
            fabricCanvas.off('mouse:down', onInteractionStart);
            fabricCanvas.off('object:moving', onInteractionStart);
            fabricCanvas.off('object:scaling', onInteractionStart);
            fabricCanvas.off('object:rotating', onInteractionStart);
            fabricCanvas.off('mouse:up', onInteractionEnd);
            fabricCanvas.off('object:modified', onInteractionEnd);
            fabricCanvas.off('object:added', onContentChanged);
            fabricCanvas.off('object:removed', onContentChanged);
        };
    }, [fabricCanvas, settings.enabled, refreshProof, overlayCanvasRef]);

    useEffect(() => {
        if (settings.enabled && isWorkerReady) refreshProof();
    }, [settings.outputProfileId, settings.showGamutWarning, settings.enabled, isWorkerReady, refreshProof]);

    const setEnabled = useCallback((enabled: boolean) => {
        const newSettings = { ...settings, enabled };
        setSettings(newSettings);
        saveProofingSettings(newSettings);
        if (enabled) toast.info('Soft proof aktiveret');
        else if (overlayCanvasRef.current) {
            const ctx = overlayCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
    }, [settings, overlayCanvasRef, canvasWidth, canvasHeight]);

    const setOutputProfile = useCallback((profileId: string) => {
        const newSettings = { ...settings, outputProfileId: profileId };
        setSettings(newSettings);
        saveProofingSettings(newSettings);
    }, [settings]);

    // Migration: Reset removed profiles (fogra51, swop) to default
    useEffect(() => {
        if (settings.outputProfileId === 'fogra51' || settings.outputProfileId === 'swop') {
            console.log('[Hook] Migrating from removed profile to default (fogra39)');
            setOutputProfile('fogra39');
        }
    }, [settings.outputProfileId, setOutputProfile]);

    const setShowGamutWarning = useCallback((show: boolean) => {
        const newSettings = { ...settings, showGamutWarning: show };
        setSettings(newSettings);
        saveProofingSettings(newSettings);
    }, [settings]);

    const setCustomProfile = useCallback((id: string | undefined, name: string | undefined, bytes: ArrayBuffer | null) => {
        setSettings(prev => ({ ...prev, customProfileId: id, customProfileName: name, customProfileBytes: bytes }));
    }, []);

    const hasCustomProfile = Boolean(settings.customProfileId && settings.customProfileBytes);

    const exportCMYK = useCallback(async (
        inputProfileUrl: string,
        outputProfileUrl: string,
        outputProfileBytes?: ArrayBuffer | null,
        cropRect?: { left: number; top: number; width: number; height: number }
    ): Promise<{ cmykData: Uint8Array; proofedRgbDataUrl: string; width: number; height: number }> => {
        if (!fabricCanvas || !workerRef.current) throw new Error('Designer not ready');

        // Adaptive Multiplier for Large Format
        const sourceCanvas = fabricCanvas.getElement();
        const maxDocDimMm = Math.max(canvasWidth, canvasHeight) / (96 / 25.4);
        let targetDPI = 300;
        if (maxDocDimMm > 2000) targetDPI = 100;
        else if (maxDocDimMm > 1000) targetDPI = 150;
        let multiplier = targetDPI / 96;
        const MAX_EXPORT_PIXELS = 10000;
        if (sourceCanvas.width * multiplier > MAX_EXPORT_PIXELS) multiplier = MAX_EXPORT_PIXELS / sourceCanvas.width;
        if (sourceCanvas.height * multiplier > MAX_EXPORT_PIXELS) multiplier = MAX_EXPORT_PIXELS / sourceCanvas.height;

        const dataUrl = fabricCanvas.toDataURL({
            multiplier,
            format: 'png',
            ...(cropRect || {})
        });

        const img = new Image();
        await new Promise((resolve) => { img.onload = resolve; img.src = dataUrl; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Context failed');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        let inputBytes: ArrayBuffer, outputBytes: ArrayBuffer;
        try {
            const inputPromise = fetch(inputProfileUrl).then(r => r.ok ? r.arrayBuffer() : Promise.reject('Input missing'));

            // Correct logic for choosing custom bytes in export
            const isCustom = outputProfileBytes &&
                settings.customProfileId &&
                (settings.outputProfileId === settings.customProfileId);

            const outputPromise = isCustom
                ? Promise.resolve(outputProfileBytes!.slice(0))
                : fetch(outputProfileUrl).then(r => r.ok ? r.arrayBuffer() : Promise.reject('Output missing'));

            [inputBytes, outputBytes] = await Promise.all([inputPromise, outputPromise]);
        } catch (err) {
            console.warn('ICC Profiles missing, falling back to RGB export:', err);
            return { cmykData: new Uint8Array(0), proofedRgbDataUrl: dataUrl, width: img.width, height: img.height };
        }

        const id = `export-${Date.now()}`;
        return new Promise((resolve, reject) => {
            const handler = (e: MessageEvent) => {
                if (e.data.id === id) {
                    workerRef.current?.removeEventListener('message', handler);
                    if (e.data.type === 'cmyk-transformed') {
                        const { proofedImageData, cmykData, width: w, height: h } = e.data;
                        const resCanvas = document.createElement('canvas');
                        resCanvas.width = w; resCanvas.height = h;
                        const resCtx = resCanvas.getContext('2d');
                        if (resCtx) {
                            resCtx.putImageData(proofedImageData, 0, 0);
                            resolve({ cmykData, proofedRgbDataUrl: resCanvas.toDataURL('image/png'), width: w, height: h });
                        } else reject(new Error('Final context failed'));
                    } else reject(new Error(e.data.error || 'Export failed'));
                }
            };
            workerRef.current?.addEventListener('message', handler);
            workerRef.current?.postMessage({
                type: 'transform-to-cmyk',
                id, imageData, inputProfileData: inputBytes, outputProfileData: outputBytes
            }, [imageData.data.buffer, inputBytes, outputBytes]);
        });
    }, [fabricCanvas, canvasWidth, canvasHeight, settings.customProfileId, settings.outputProfileId]);

    return {
        settings, isProcessing, error, setEnabled, setOutputProfile, setShowGamutWarning,
        setCustomProfile, refreshProof, hasCustomProfile, exportCMYK,
    };
}

export default useColorProofing;
