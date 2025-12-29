/**
 * Color Proofing Web Worker
 * 
 * Performs ICC color transformations in a background thread
 * Uses lcms-wasm for accurate color management
 */

import lcms from 'lcms-wasm';

let lcmsModule: Awaited<ReturnType<typeof lcms>> | null = null;
let inputProfile: any = null;
let outputProfile: any = null;
let proofTransform: any = null;

// Initialize lcms-wasm module
async function initLcms(): Promise<void> {
    if (!lcmsModule) {
        lcmsModule = await lcms();
    }
}

// Create profiles and transform from ArrayBuffers
async function createTransform(
    inputProfileData: ArrayBuffer,
    outputProfileData: ArrayBuffer
): Promise<void> {
    await initLcms();
    if (!lcmsModule) throw new Error('LCMS module not initialized');

    // Dispose old profiles if they exist
    if (inputProfile) {
        try { lcmsModule.cmsCloseProfile(inputProfile); } catch (e) { /* ignore */ }
    }
    if (outputProfile) {
        try { lcmsModule.cmsCloseProfile(outputProfile); } catch (e) { /* ignore */ }
    }
    if (proofTransform) {
        try { lcmsModule.cmsDeleteTransform(proofTransform); } catch (e) { /* ignore */ }
    }

    // Create profiles from data
    const inputData = new Uint8Array(inputProfileData);
    const outputData = new Uint8Array(outputProfileData);

    inputProfile = lcmsModule.cmsOpenProfileFromMem(inputData, inputData.length);
    outputProfile = lcmsModule.cmsOpenProfileFromMem(outputData, outputData.length);

    if (!inputProfile || !outputProfile) {
        throw new Error('Failed to create ICC profiles');
    }

    // Create proofing transform: RGB -> CMYK -> RGB (soft proof simulation)
    // This simulates how colors will look when printed on the target profile
    // We use SOFTPROOFING intent with the output profile as proofing profile
    const TYPE_RGB_8 = 262169; // (3 << 16) | (1 << 9) | (8 << 3) | 1
    const INTENT_RELATIVE_COLORIMETRIC = 1;
    const cmsFLAGS_SOFTPROOFING = 0x4000;
    const cmsFLAGS_GAMUTCHECK = 0x1000;

    // Create a proofing transform
    proofTransform = lcmsModule.cmsCreateProofingTransform(
        inputProfile,
        TYPE_RGB_8,
        inputProfile, // Output back to sRGB for display
        TYPE_RGB_8,
        outputProfile, // Proofing profile (CMYK)
        INTENT_RELATIVE_COLORIMETRIC,
        INTENT_RELATIVE_COLORIMETRIC,
        cmsFLAGS_SOFTPROOFING
    );

    if (!proofTransform) {
        throw new Error('Failed to create proofing transform');
    }
}

// Transform image data
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

    // Create output arrays
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

    // Process pixels in batches for better performance
    const BATCH_SIZE = 4096;
    const inputBatch = new Uint8Array(BATCH_SIZE * 3);
    const outputBatch = new Uint8Array(BATCH_SIZE * 3);

    for (let batchStart = 0; batchStart < pixelCount; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, pixelCount);
        const batchPixels = batchEnd - batchStart;

        // Copy input pixels (RGB only, skip alpha)
        for (let i = 0; i < batchPixels; i++) {
            const srcIdx = (batchStart + i) * 4;
            inputBatch[i * 3] = data[srcIdx];
            inputBatch[i * 3 + 1] = data[srcIdx + 1];
            inputBatch[i * 3 + 2] = data[srcIdx + 2];
        }

        // Transform batch
        lcmsModule.cmsDoTransform(proofTransform, inputBatch, outputBatch, batchPixels);

        // Copy to output with alpha preserved
        for (let i = 0; i < batchPixels; i++) {
            const dstIdx = (batchStart + i) * 4;
            const srcIdx = (batchStart + i) * 4;

            proofedData[dstIdx] = outputBatch[i * 3];
            proofedData[dstIdx + 1] = outputBatch[i * 3 + 1];
            proofedData[dstIdx + 2] = outputBatch[i * 3 + 2];
            proofedData[dstIdx + 3] = data[srcIdx + 3]; // Preserve alpha

            // Check for gamut warning (significant color shift)
            if (gamutData) {
                const origR = data[srcIdx];
                const origG = data[srcIdx + 1];
                const origB = data[srcIdx + 2];
                const proofR = outputBatch[i * 3];
                const proofG = outputBatch[i * 3 + 1];
                const proofB = outputBatch[i * 3 + 2];

                // Calculate color difference (simplified delta)
                const deltaR = Math.abs(origR - proofR);
                const deltaG = Math.abs(origG - proofG);
                const deltaB = Math.abs(origB - proofB);
                const delta = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);

                // Threshold for "out of gamut" (adjustable)
                const GAMUT_THRESHOLD = 25;
                if (delta > GAMUT_THRESHOLD) {
                    gamutData[dstIdx] = gamutR;
                    gamutData[dstIdx + 1] = gamutG;
                    gamutData[dstIdx + 2] = gamutB;
                    gamutData[dstIdx + 3] = 180; // Semi-transparent overlay
                } else {
                    gamutData[dstIdx + 3] = 0; // Fully transparent
                }
            }
        }
    }

    const proofedImageData = new ImageData(proofedData, width, height);
    const gamutMaskImageData = gamutData ? new ImageData(gamutData, width, height) : null;

    return { proofed: proofedImageData, gamutMask: gamutMaskImageData };
}

// Handle messages from main thread
self.onmessage = async (e: MessageEvent) => {
    const message = e.data;

    try {
        switch (message.type) {
            case 'init':
                await initLcms();
                if (message.inputProfileData && message.outputProfileData) {
                    await createTransform(message.inputProfileData, message.outputProfileData);
                }
                self.postMessage({ type: 'ready', id: message.id });
                break;

            case 'transform':
                if (!proofTransform) {
                    throw new Error('Transform not initialized');
                }

                const { imageData, showGamutWarning, gamutWarningColor } = message;
                const result = transformImageData(imageData, showGamutWarning || false, gamutWarningColor || '#00ff00');

                // Transfer image data back
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

            case 'dispose':
                if (inputProfile && lcmsModule) {
                    try { lcmsModule.cmsCloseProfile(inputProfile); } catch (e) { /* ignore */ }
                }
                if (outputProfile && lcmsModule) {
                    try { lcmsModule.cmsCloseProfile(outputProfile); } catch (e) { /* ignore */ }
                }
                if (proofTransform && lcmsModule) {
                    try { lcmsModule.cmsDeleteTransform(proofTransform); } catch (e) { /* ignore */ }
                }
                inputProfile = null;
                outputProfile = null;
                proofTransform = null;
                self.postMessage({ type: 'disposed', id: message.id });
                break;
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            id: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export { };
