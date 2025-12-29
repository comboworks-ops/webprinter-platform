/**
 * Simple CMYK Soft Proof Simulation
 * 
 * This is a simplified RGB→CMYK→RGB simulation that works without
 * external ICC profiles. It provides a reasonable approximation of
 * how colors will shift when printed.
 * 
 * For production-accurate proofing, a proper ICC workflow is recommended.
 */

// CMYK simulation parameters (approximating FOGRA39/coated paper)
interface CMYKSimParams {
    // Dot gain simulation (increases darkness)
    dotGain: number;
    // Black generation threshold
    blackThreshold: number;
    // Maximum ink coverage
    maxInk: number;
    // Gamut compression factor
    gamutCompression: number;
}

const PROFILE_PARAMS: Record<string, CMYKSimParams> = {
    fogra39: {
        dotGain: 0.15,
        blackThreshold: 0.3,
        maxInk: 3.2,
        gamutCompression: 0.92,
    },
    fogra51: {
        dotGain: 0.12,
        blackThreshold: 0.25,
        maxInk: 3.3,
        gamutCompression: 0.94,
    },
    swop: {
        dotGain: 0.18,
        blackThreshold: 0.35,
        maxInk: 3.0,
        gamutCompression: 0.90,
    },
};

/**
 * Convert RGB to CMYK
 */
function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
    // Normalize to 0-1
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;

    // Find K (black)
    const k = 1 - Math.max(rn, gn, bn);

    if (k === 1) {
        return [0, 0, 0, 1];
    }

    // Calculate CMY
    const c = (1 - rn - k) / (1 - k);
    const m = (1 - gn - k) / (1 - k);
    const y = (1 - bn - k) / (1 - k);

    return [c, m, y, k];
}

/**
 * Convert CMYK back to RGB with profile simulation
 */
function cmykToRgbWithProfile(
    c: number,
    m: number,
    y: number,
    k: number,
    params: CMYKSimParams
): [number, number, number] {
    // Apply dot gain simulation
    const cAdj = Math.min(1, c + c * params.dotGain);
    const mAdj = Math.min(1, m + m * params.dotGain);
    const yAdj = Math.min(1, y + y * params.dotGain);
    const kAdj = Math.min(1, k + k * params.dotGain * 0.5);

    // Total ink coverage check
    const totalInk = cAdj + mAdj + yAdj + kAdj;
    let scale = 1;
    if (totalInk > params.maxInk) {
        scale = params.maxInk / totalInk;
    }

    const cFinal = cAdj * scale;
    const mFinal = mAdj * scale;
    const yFinal = yAdj * scale;
    const kFinal = kAdj * scale;

    // Convert back to RGB
    const rn = (1 - cFinal) * (1 - kFinal);
    const gn = (1 - mFinal) * (1 - kFinal);
    const bn = (1 - yFinal) * (1 - kFinal);

    // Apply gamut compression (moves colors toward neutral)
    const gray = (rn + gn + bn) / 3;
    const gc = params.gamutCompression;
    const rnFinal = rn * gc + gray * (1 - gc);
    const gnFinal = gn * gc + gray * (1 - gc);
    const bnFinal = bn * gc + gray * (1 - gc);

    return [
        Math.round(Math.min(255, Math.max(0, rnFinal * 255))),
        Math.round(Math.min(255, Math.max(0, gnFinal * 255))),
        Math.round(Math.min(255, Math.max(0, bnFinal * 255))),
    ];
}

/**
 * Check if a color is out of CMYK gamut
 * Returns a value 0-1 indicating how far out of gamut
 */
function getGamutDistance(r: number, g: number, b: number, params: CMYKSimParams): number {
    // Convert to CMYK and back
    const [c, m, y, k] = rgbToCmyk(r, g, b);
    const [rNew, gNew, bNew] = cmykToRgbWithProfile(c, m, y, k, params);

    // Calculate color difference
    const deltaR = Math.abs(r - rNew);
    const deltaG = Math.abs(g - gNew);
    const deltaB = Math.abs(b - bNew);

    // Simple Euclidean distance normalized
    const delta = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);

    // Threshold for "significant" difference
    return Math.min(1, delta / 50);
}

// Worker message handler
self.onmessage = (e: MessageEvent) => {
    const { type, id, imageData, profileId, showGamutWarning, gamutWarningColor } = e.data;

    if (type !== 'transform') {
        self.postMessage({ type: 'error', id, error: 'Unknown message type' });
        return;
    }

    try {
        const params = PROFILE_PARAMS[profileId] || PROFILE_PARAMS.fogra39;
        const { width, height, data } = imageData;

        // Create output data
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

        const GAMUT_THRESHOLD = 0.3; // 30% deviation triggers warning

        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Convert through CMYK
            const [c, m, y, k] = rgbToCmyk(r, g, b);
            const [rNew, gNew, bNew] = cmykToRgbWithProfile(c, m, y, k, params);

            proofedData[i] = rNew;
            proofedData[i + 1] = gNew;
            proofedData[i + 2] = bNew;
            proofedData[i + 3] = a;

            // Gamut warning
            if (gamutData) {
                const gamutDist = getGamutDistance(r, g, b, params);
                if (gamutDist > GAMUT_THRESHOLD) {
                    const opacity = Math.min(180, Math.round(gamutDist * 200));
                    gamutData[i] = gamutR;
                    gamutData[i + 1] = gamutG;
                    gamutData[i + 2] = gamutB;
                    gamutData[i + 3] = opacity;
                } else {
                    gamutData[i + 3] = 0;
                }
            }
        }

        const proofedImageData = new ImageData(proofedData, width, height);
        const gamutMaskImageData = gamutData ? new ImageData(gamutData, width, height) : null;

        // Send back with transferable buffers
        const transferables = [proofedImageData.data.buffer];
        if (gamutMaskImageData) {
            transferables.push(gamutMaskImageData.data.buffer);
        }

        self.postMessage(
            {
                type: 'transformed',
                id,
                imageData: proofedImageData,
                gamutMask: gamutMaskImageData,
            },
            // @ts-ignore
            transferables
        );
    } catch (error) {
        self.postMessage({
            type: 'error',
            id,
            error: error instanceof Error ? error.message : 'Transform failed',
        });
    }
};

export { };
