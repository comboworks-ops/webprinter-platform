/**
 * useColorProofing Hook
 * 
 * Manages color proofing state, worker communication, and overlay rendering
 * Uses a simplified CMYK simulation that works without external ICC profiles
 * Supports custom per-product ICC profiles when provided
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import {
    ProofingSettings,
    loadProofingSettings,
    saveProofingSettings,
    OUTPUT_PROFILES,
} from '@/lib/color/iccProofing';
import { toast } from 'sonner';

// Debounce time for canvas updates (ms)
const DEBOUNCE_MS = 200;

// Max dimension for proofing preview (performance)
const MAX_PREVIEW_DIMENSION = 1200;

interface UseColorProofingOptions {
    fabricCanvas: fabric.Canvas | null;
    overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
    canvasWidth: number;
    canvasHeight: number;
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
}

export function useColorProofing({
    fabricCanvas,
    overlayCanvasRef,
    canvasWidth,
    canvasHeight,
    customProfileId,
    customProfileName,
    customProfileBytes,
}: UseColorProofingOptions): UseColorProofingReturn {
    const [settings, setSettings] = useState<ProofingSettings>(() => {
        const base = loadProofingSettings();
        // Apply custom profile if provided
        if (customProfileId && customProfileBytes) {
            return {
                ...base,
                customProfileId,
                customProfileName,
                customProfileBytes,
            };
        }
        return base;
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false); // Track active interaction

    const workerRef = useRef<Worker | null>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const messageIdRef = useRef(0);
    const lastProcessedRef = useRef<string>('');

    // Initialize worker
    useEffect(() => {
        try {
            const worker = new Worker(
                new URL('../workers/simpleProofing.worker.ts', import.meta.url),
                { type: 'module' }
            );

            workerRef.current = worker;

            worker.onmessage = (e) => {
                const msg = e.data;

                if (msg.type === 'transformed') {
                    setIsProcessing(false);
                    setError(null);

                    if (msg.imageData && overlayCanvasRef.current) {
                        const overlay = overlayCanvasRef.current;
                        const ctx = overlay.getContext('2d');

                        if (ctx) {
                            // Scale to full canvas size
                            overlay.width = canvasWidth;
                            overlay.height = canvasHeight;

                            // Create temp canvas for transformed data
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = msg.imageData.width;
                            tempCanvas.height = msg.imageData.height;
                            const tempCtx = tempCanvas.getContext('2d');

                            if (tempCtx) {
                                tempCtx.putImageData(msg.imageData, 0, 0);

                                // Draw scaled to overlay
                                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                                ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);

                                // Draw gamut mask if present
                                if (msg.gamutMask) {
                                    const gamutCanvas = document.createElement('canvas');
                                    gamutCanvas.width = msg.gamutMask.width;
                                    gamutCanvas.height = msg.gamutMask.height;
                                    const gamutCtx = gamutCanvas.getContext('2d');

                                    if (gamutCtx) {
                                        gamutCtx.putImageData(msg.gamutMask, 0, 0);
                                        ctx.drawImage(gamutCanvas, 0, 0, canvasWidth, canvasHeight);
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

            worker.onerror = (e) => {
                console.error('Worker error:', e);
                setError('Worker initialization failed');
            };

            return () => {
                worker.terminate();
                workerRef.current = null;
            };
        } catch (err) {
            console.error('Failed to create worker:', err);
            setError('Could not initialize color proofing');
        }
    }, [overlayCanvasRef, canvasWidth, canvasHeight]);

    // Capture and process canvas
    const processCanvas = useCallback(() => {
        if (!fabricCanvas || !workerRef.current || !settings.enabled) {
            // Clear overlay if disabled
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                }
            }
            return;
        }

        try {
            // Get canvas element
            const sourceCanvas = fabricCanvas.getElement();
            const sourceWidth = sourceCanvas.width;
            const sourceHeight = sourceCanvas.height;

            // Calculate downsampled dimensions for performance
            let width = sourceWidth;
            let height = sourceHeight;

            if (width > MAX_PREVIEW_DIMENSION || height > MAX_PREVIEW_DIMENSION) {
                const scale = MAX_PREVIEW_DIMENSION / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }

            // Create offscreen canvas for downsampling
            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');

            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            // Draw downsampled
            ctx.drawImage(sourceCanvas, 0, 0, width, height);
            const imageData = ctx.getImageData(0, 0, width, height);

            // Create unique ID to detect stale responses
            const id = `transform-${++messageIdRef.current}`;

            setIsProcessing(true);

            // Send to worker
            workerRef.current.postMessage(
                {
                    type: 'transform',
                    id,
                    imageData,
                    profileId: settings.outputProfileId,
                    showGamutWarning: settings.showGamutWarning,
                    gamutWarningColor: '#00ff00',
                },
                [imageData.data.buffer]
            );
        } catch (err) {
            console.error('Failed to process canvas:', err);
            setIsProcessing(false);
            setError(err instanceof Error ? err.message : 'Processing failed');
        }
    }, [fabricCanvas, settings, overlayCanvasRef]);

    // Debounced refresh
    const refreshProof = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            processCanvas();
        }, DEBOUNCE_MS);
    }, [processCanvas]);

    // Subscribe to fabric canvas events
    useEffect(() => {
        if (!fabricCanvas || !settings.enabled) {
            // Clear overlay when disabled
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                }
            }
            return;
        }

        // Hide overlay when interaction starts (for smooth dragging)
        const onInteractionStart = () => {
            setIsInteracting(true);
            if (overlayCanvasRef.current) {
                overlayCanvasRef.current.style.opacity = '0';
            }
        };

        // Show overlay and refresh when interaction ends
        const onInteractionEnd = () => {
            setIsInteracting(false);
            // Clear the old proof image first to prevent "snap back" flicker
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                }
                overlayCanvasRef.current.style.opacity = '1';
            }
            // Then generate the new proof
            refreshProof();
        };

        // Events that indicate content has changed (after interaction)
        const onContentChanged = () => refreshProof();

        // Start interaction events
        fabricCanvas.on('mouse:down', onInteractionStart);
        fabricCanvas.on('object:moving', onInteractionStart);
        fabricCanvas.on('object:scaling', onInteractionStart);
        fabricCanvas.on('object:rotating', onInteractionStart);

        // End interaction events
        fabricCanvas.on('mouse:up', onInteractionEnd);
        fabricCanvas.on('object:modified', onInteractionEnd);

        // Content changed events
        fabricCanvas.on('object:added', onContentChanged);
        fabricCanvas.on('object:removed', onContentChanged);

        // Initial render
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
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [fabricCanvas, settings.enabled, refreshProof, overlayCanvasRef]);

    // Refresh when profile changes
    useEffect(() => {
        if (settings.enabled) {
            refreshProof();
        }
    }, [settings.outputProfileId, settings.showGamutWarning, settings.enabled, refreshProof]);

    // Settings handlers
    const setEnabled = useCallback((enabled: boolean) => {
        const newSettings = { ...settings, enabled };
        setSettings(newSettings);
        saveProofingSettings(newSettings);

        if (enabled) {
            toast.info('Soft proof aktiveret - farver simulerer CMYK output');
        } else {
            // Clear overlay
            if (overlayCanvasRef.current) {
                const ctx = overlayCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
                }
            }
        }
    }, [settings, overlayCanvasRef]);

    const setOutputProfile = useCallback((profileId: string) => {
        const newSettings = { ...settings, outputProfileId: profileId };
        setSettings(newSettings);
        saveProofingSettings(newSettings);

        const profile = OUTPUT_PROFILES.find(p => p.id === profileId);
        if (profile) {
            toast.info(`Skiftet til ${profile.name}`);
        }
    }, [settings]);

    const setShowGamutWarning = useCallback((show: boolean) => {
        const newSettings = { ...settings, showGamutWarning: show };
        setSettings(newSettings);
        saveProofingSettings(newSettings);
    }, [settings]);

    // Set custom profile (from product)
    const setCustomProfile = useCallback((
        id: string | undefined,
        name: string | undefined,
        bytes: ArrayBuffer | null
    ) => {
        const newSettings = {
            ...settings,
            customProfileId: id,
            customProfileName: name,
            customProfileBytes: bytes,
        };
        setSettings(newSettings);

        if (id && name) {
            toast.info(`Bruger produktets farveprofil: ${name}`);
        }
    }, [settings]);

    const hasCustomProfile = Boolean(settings.customProfileId && settings.customProfileBytes);

    return {
        settings,
        isProcessing,
        error,
        setEnabled,
        setOutputProfile,
        setShowGamutWarning,
        setCustomProfile,
        refreshProof,
        hasCustomProfile,
    };
}

export default useColorProofing;
