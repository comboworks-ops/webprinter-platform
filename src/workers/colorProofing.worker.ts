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
 * Color Proofing Web Worker
 * 
 * Performs ICC color transformations in a background thread using lcms-wasm.
 * 
 * CRITICAL: The lcms-wasm API is:
 *   const output = cmsDoTransform(transform, inputArray, pixelCount)
 * It RETURNS the output - do NOT pass 4 parameters!
 */

import lcms from 'lcms-wasm';

let lcmsModule: Awaited<ReturnType<typeof lcms>> | null = null;
let inputProfile: any = null;
let outputProfile: any = null;
let proofTransform: any = null;

let isInitializingLcms = false;

// Initialize lcms-wasm module
async function initLcms(): Promise<void> {
    if (lcmsModule) return;
    if (isInitializingLcms) {
        // Wait for existing initialization
        while (isInitializingLcms) {
            await new Promise(r => setTimeout(r, 50));
        }
        return;
    }

    isInitializingLcms = true;
    try {
        console.log('[Worker] Initializing LCMS WASM...');
        // @ts-ignore - lcms-wasm's types might not show the Emscripten options
        lcmsModule = await lcms({
            locateFile: (path: string) => {
                if (path.endsWith('.wasm')) {
                    return '/lcms.wasm';
                }
                return path;
            }
        });
        console.log('[Worker] LCMS WASM initialized successfully');
    } catch (err) {
        console.error('Failed to initialize LCMS in worker:', err);
        throw err;
    } finally {
        isInitializingLcms = false;
    }
}

// Create profiles and transform from ArrayBuffers
async function createTransform(
    inputProfileData: ArrayBuffer,
    outputProfileData: ArrayBuffer
): Promise<void> {
    await initLcms();
    if (!lcmsModule) throw new Error('LCMS module not initialized');

    console.log('[Worker] Creating transform...');

    // Dispose old profiles if they exist
    if (proofTransform) { try { lcmsModule.cmsDeleteTransform(proofTransform); } catch (e) { /* ignore */ } }
    if (inputProfile) { try { lcmsModule.cmsCloseProfile(inputProfile); } catch (e) { /* ignore */ } }
    if (outputProfile) { try { lcmsModule.cmsCloseProfile(outputProfile); } catch (e) { /* ignore */ } }

    // Create profiles from data
    const inputBytes = new Uint8Array(inputProfileData);
    const outputBytes = new Uint8Array(outputProfileData);

    console.log(`[Worker] Received binary data: sRGB=${inputBytes.length} bytes, Target=${outputBytes.length} bytes`);

    if (inputBytes.length === 0 || outputBytes.length === 0) {
        throw new Error(`Invalid binary data: Empty profile (sRGB: ${inputBytes.length}, Target: ${outputBytes.length})`);
    }

    inputProfile = lcmsModule.cmsOpenProfileFromMem(inputBytes, inputBytes.length);
    outputProfile = lcmsModule.cmsOpenProfileFromMem(outputBytes, outputBytes.length);

    if (!inputProfile || !outputProfile) {
        const getHeader = (arr: Uint8Array) => Array.from(arr.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const inHead = getHeader(inputBytes);
        const outHead = getHeader(outputBytes);
        console.error(`[Worker] Failed. Headers: Input=[${inHead}] Output=[${outHead}]`);
        throw new Error(`Invalid ICC Data. InputHeader: ${inHead.slice(0, 12)}... OutputHeader: ${outHead.slice(0, 12)}...`);
    }

    // Create proofing transform: RGB -> RGB (with CMYK gamut simulation)
    // cmsCreateProofingTransform does: Input -> Proof Profile -> Output  

    // Correct LCMS constants: (PT_TYPE << 16) | (CHANNELS << 3) | BYTES
    const PT_RGB = 4;
    const TYPE_RGB_8 = (PT_RGB << 16) | (3 << 3) | 1;   // = 262169

    const INTENT_RELATIVE_COLORIMETRIC = 1;
    const cmsFLAGS_SOFTPROOFING = 0x4000;

    console.log('[Worker] Creating proofing transform with TYPE_RGB_8:', TYPE_RGB_8);

    // Create a proofing transform: RGB input -> RGB output, using CMYK as proofing profile
    proofTransform = lcmsModule.cmsCreateProofingTransform(
        inputProfile,     // Input: sRGB
        TYPE_RGB_8,       // Input format: RGB 8-bit
        inputProfile,     // Output: sRGB (for display)
        TYPE_RGB_8,       // Output format: RGB 8-bit
        outputProfile,    // Proofing profile: CMYK (FOGRA39)
        INTENT_RELATIVE_COLORIMETRIC,
        INTENT_RELATIVE_COLORIMETRIC,
        cmsFLAGS_SOFTPROOFING
    );

    if (!proofTransform) {
        console.error('[Worker] Proofing transform creation failed');
        throw new Error('Failed to create proofing transform');
    }

    console.log('[Worker] Transform ready (soft proof mode)');
}

// Transform image data using CORRECT lcms-wasm API
// The API is: cmsDoTransform(transform, inputArr, size) => returns outputArr
function transformImageData(
    imageData: ImageData,
    showGamutWarning: boolean,
    gamutWarningColor: string
): { proofed: ImageData; gamutMask: ImageData | null } {
    if (!lcmsModule || !proofTransform) {
        throw new Error('Transform not initialized');
    }

    const { width, height, data } = imageData;
    const pixelCount = width * height;

    console.log(`[Worker] Transform requested: ${width}x${height} = ${pixelCount} pixels`);

    if (width <= 0 || height <= 0 || pixelCount <= 0) {
        throw new Error(`Invalid canvas dimensions: ${width}x${height}`);
    }

    const proofedData = new Uint8ClampedArray(data.length);
    const gamutData = showGamutWarning ? new Uint8ClampedArray(data.length) : null;

    // Parse gamut warning color
    let gamutR = 0, gamutG = 255, gamutB = 0;
    if (gamutWarningColor) {
        const match = gamutWarningColor.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (match) {
            gamutR = parseInt(match[1], 16);
            gamutG = parseInt(match[2], 16);
            gamutB = parseInt(match[3], 16);
        }
    }

    // Process in batches for large images (memory management)
    // lcms-wasm cmsDoTransform takes (transform, inputArr, pixelCount) and RETURNS outputArr
    const BATCH_SIZE = 4096; // pixels per batch

    for (let start = 0; start < pixelCount; start += BATCH_SIZE) {
        const count = Math.min(BATCH_SIZE, pixelCount - start);

        // Create input array for this batch (RGB only, no alpha)
        const inputBatch = new Uint8Array(count * 3);

        // Fill input batch - extract RGB from RGBA
        for (let i = 0; i < count; i++) {
            const srcIdx = (start + i) * 4;
            inputBatch[i * 3] = data[srcIdx];
            inputBatch[i * 3 + 1] = data[srcIdx + 1];
            inputBatch[i * 3 + 2] = data[srcIdx + 2];
        }

        // Transform this batch - lcms-wasm API returns the output array!
        const outputBatch = lcmsModule.cmsDoTransform(proofTransform, inputBatch, count);

        // Copy results to output
        for (let i = 0; i < count; i++) {
            const dstIdx = (start + i) * 4;
            const srcIdx = i * 3;

            const rNew = outputBatch[srcIdx];
            const gNew = outputBatch[srcIdx + 1];
            const bNew = outputBatch[srcIdx + 2];

            proofedData[dstIdx] = rNew;
            proofedData[dstIdx + 1] = gNew;
            proofedData[dstIdx + 2] = bNew;
            proofedData[dstIdx + 3] = data[dstIdx + 3]; // Preserve alpha

            if (gamutData) {
                const rOld = data[dstIdx];
                const gOld = data[dstIdx + 1];
                const bOld = data[dstIdx + 2];

                // Out-of-gamut detection based on color shift
                const delta = Math.abs(rOld - rNew) + Math.abs(gOld - gNew) + Math.abs(bOld - bNew);
                if (delta > 35) {
                    gamutData[dstIdx] = gamutR;
                    gamutData[dstIdx + 1] = gamutG;
                    gamutData[dstIdx + 2] = gamutB;
                    gamutData[dstIdx + 3] = 150;
                } else {
                    gamutData[dstIdx + 3] = 0;
                }
            }
        }
    }

    console.log('[Worker] Transform completed successfully');

    return {
        proofed: new ImageData(proofedData, width, height),
        gamutMask: gamutData ? new ImageData(gamutData, width, height) : null
    };
}

// Handle messages from main thread
self.onmessage = async (e: MessageEvent) => {
    const message = e.data;

    try {
        switch (message.type) {
            case 'init':
                const { inputProfileData, outputProfileData } = message;
                await createTransform(inputProfileData, outputProfileData);
                self.postMessage({ type: 'ready', id: message.id });
                break;

            case 'transform':
                if (!proofTransform) {
                    throw new Error('Transform not initialized');
                }

                const result = transformImageData(
                    message.imageData,
                    message.showGamutWarning || false,
                    message.gamutWarningColor || '#00ff00'
                );

                self.postMessage(
                    {
                        type: 'transformed',
                        id: message.id,
                        imageData: result.proofed,
                        gamutMask: result.gamutMask
                    },
                    // @ts-ignore - transferable objects
                    [result.proofed.data.buffer, ...(result.gamutMask ? [result.gamutMask.data.buffer] : [])]
                );
                break;

            case 'transform-to-cmyk':
                // For export, create a CMYK transform
                if (!lcmsModule || !inputProfile || !outputProfile) {
                    throw new Error('Profiles not initialized');
                }

                // Load profiles for export
                const inputBytes = new Uint8Array(message.inputProfileData);
                const outputBytes = new Uint8Array(message.outputProfileData);

                const inProf = lcmsModule.cmsOpenProfileFromMem(inputBytes, inputBytes.length);
                const outProf = lcmsModule.cmsOpenProfileFromMem(outputBytes, outputBytes.length);

                if (!inProf || !outProf) throw new Error('Failed to load export profiles');

                const PT_RGB = 4;
                const PT_CMYK = 6;
                const TYPE_RGB_8 = (PT_RGB << 16) | (3 << 3) | 1;
                const TYPE_CMYK_8 = (PT_CMYK << 16) | (4 << 3) | 1;
                const INTENT_RELATIVE_COLORIMETRIC = 1;
                const cmsFLAGS_SOFTPROOFING = 0x4000;

                // RGB -> CMYK transform for actual CMYK data
                const exportTransform = lcmsModule.cmsCreateTransform(
                    inProf, TYPE_RGB_8,
                    outProf, TYPE_CMYK_8,
                    INTENT_RELATIVE_COLORIMETRIC, 0
                );

                // RGB -> RGB (soft proofed) for preview
                const proofEmbedTransform = lcmsModule.cmsCreateProofingTransform(
                    inProf, TYPE_RGB_8,
                    inProf, TYPE_RGB_8,
                    outProf,
                    INTENT_RELATIVE_COLORIMETRIC, INTENT_RELATIVE_COLORIMETRIC,
                    cmsFLAGS_SOFTPROOFING
                );

                if (!exportTransform || !proofEmbedTransform) throw new Error('Failed to create export transforms');

                const { data: pixels, width: w, height: h } = message.imageData;
                const cmykBuffer = new Uint8Array(w * h * 4);
                const rgbBuffer = new Uint8ClampedArray(w * h * 4);

                const EXP_BATCH = 4096;

                for (let i = 0; i < w * h; i += EXP_BATCH) {
                    const count = Math.min(EXP_BATCH, (w * h) - i);

                    // Create input batch
                    const inB = new Uint8Array(count * 3);
                    for (let j = 0; j < count; j++) {
                        const idx = (i + j) * 4;
                        inB[j * 3] = pixels[idx];
                        inB[j * 3 + 1] = pixels[idx + 1];
                        inB[j * 3 + 2] = pixels[idx + 2];
                    }

                    // Transform to CMYK (returns output array)
                    const outCMYK = lcmsModule.cmsDoTransform(exportTransform, inB, count);
                    // Transform to proofed RGB
                    const outRGB = lcmsModule.cmsDoTransform(proofEmbedTransform, inB, count);

                    for (let j = 0; j < count; j++) {
                        const idx = (i + j) * 4;
                        cmykBuffer[idx] = outCMYK[j * 4];
                        cmykBuffer[idx + 1] = outCMYK[j * 4 + 1];
                        cmykBuffer[idx + 2] = outCMYK[j * 4 + 2];
                        cmykBuffer[idx + 3] = outCMYK[j * 4 + 3];

                        rgbBuffer[idx] = outRGB[j * 3];
                        rgbBuffer[idx + 1] = outRGB[j * 3 + 1];
                        rgbBuffer[idx + 2] = outRGB[j * 3 + 2];
                        rgbBuffer[idx + 3] = pixels[idx + 3]; // Alpha
                    }
                }

                lcmsModule.cmsDeleteTransform(exportTransform);
                lcmsModule.cmsDeleteTransform(proofEmbedTransform);
                lcmsModule.cmsCloseProfile(inProf);
                lcmsModule.cmsCloseProfile(outProf);

                const proofedImageData = new ImageData(rgbBuffer, w, h);

                self.postMessage({
                    type: 'cmyk-transformed',
                    id: message.id,
                    cmykData: cmykBuffer,
                    proofedImageData,
                    width: w,
                    height: h
                }, [cmykBuffer.buffer, proofedImageData.data.buffer]);
                break;

            case 'dispose':
                if (proofTransform) {
                    try { lcmsModule?.cmsDeleteTransform(proofTransform); } catch (e) { /* ignore */ }
                    proofTransform = null;
                }
                if (inputProfile) {
                    try { lcmsModule?.cmsCloseProfile(inputProfile); } catch (e) { /* ignore */ }
                    inputProfile = null;
                }
                if (outputProfile) {
                    try { lcmsModule?.cmsCloseProfile(outputProfile); } catch (e) { /* ignore */ }
                    outputProfile = null;
                }
                self.postMessage({ type: 'disposed', id: message.id });
                break;
        }
    } catch (error) {
        console.error('[Worker] Error:', error);
        self.postMessage({
            type: 'error',
            id: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export { };
