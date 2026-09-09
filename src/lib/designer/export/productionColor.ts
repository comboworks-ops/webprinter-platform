import lcms from 'lcms-wasm';
import { SRGB_PROFILE_URL } from '../../color/iccProofing';

export interface ProductionOutputProfile {
  id: string;
  name: string;
  bytes: ArrayBuffer;
}

/** Production conversion. Deliberately never creates a soft-proof transform. */
export async function createProductionColorTransform(profile: ProductionOutputProfile, intent = 1, blackPointCompensation = true) {
  const response = await fetch(SRGB_PROFILE_URL);
  if (!response.ok) throw new Error('sRGB-profilen kunne ikke indlæses til PDF-eksport.');
  const sourceBytes = new Uint8Array(await response.arrayBuffer());
  const targetBytes = new Uint8Array(profile.bytes);
  // The resolver validates this too; enforce the production boundary independently.
  if (targetBytes.length < 132 || String.fromCharCode(...targetBytes.slice(16, 20)) !== 'CMYK') {
    throw new Error('Produktionsprofilen skal være en gyldig CMYK ICC-profil.');
  }
  const module = await lcms({ locateFile: (path: string) => path.endsWith('.wasm') ? '/lcms.wasm' : path });
  const source = module.cmsOpenProfileFromMem(sourceBytes, sourceBytes.length);
  const target = module.cmsOpenProfileFromMem(targetBytes, targetBytes.length);
  let transform: number | null = null;
  const dispose = () => {
    if (transform) module.cmsDeleteTransform(transform);
    if (source) module.cmsCloseProfile(source);
    if (target) module.cmsCloseProfile(target);
    transform = null;
  };
  try {
    if (!source || !target) throw new Error('ICC-profilerne kunne ikke åbnes.');
    transform = module.cmsCreateTransform(source, (4 << 16) | (3 << 3) | 1,
      target, (6 << 16) | (4 << 3) | 1, intent, blackPointCompensation ? 0x2000 : 0);
    if (!transform) throw new Error('ICC-produktionskonverteringen kunne ikke oprettes.');
  } catch (error) { dispose(); throw error; }
  return {
    convert(rgb: Uint8Array): Uint8Array {
      if (!transform || rgb.length % 3) throw new Error('Ugyldige RGB-data til produktionskonvertering.');
      const output = new Uint8Array(rgb.length / 3 * 4);
      for (let start = 0; start < rgb.length / 3; start += 4096) {
        const count = Math.min(4096, rgb.length / 3 - start);
        output.set(module.cmsDoTransform(transform, rgb.subarray(start * 3, (start + count) * 3), count), start * 4);
      }
      return output;
    },
    dispose,
  };
}

export type ProductionColorTransform = Awaited<ReturnType<typeof createProductionColorTransform>>;
