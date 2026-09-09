/** Structural ICC checks before bytes reach the native/WASM parser. */
export const MAX_ICC_PROFILE_BYTES = 16 * 1024 * 1024;

export interface IccProfileMetadata {
    version: string;
    deviceClass: string;
    colorSpace: string;
    pcs: string;
    byteLength: number;
    tagCount: number;
    description: string | null;
    /** Embedded identifier, exposed as metadata; SHA-256 below identifies actual bytes. */
    profileId: string | null;
    sha256: string;
}

export interface IccValidationOptions {
    expectedColorSpace?: 'CMYK' | 'RGB';
    expectedClass?: 'prtr' | 'mntr' | 'scnr' | 'spac';
    expectedSha256?: string;
}

const signatureAt = (data: Uint8Array, offset: number) =>
    String.fromCharCode(...data.subarray(offset, offset + 4));
const hex = (data: Uint8Array) => Array.from(data, value => value.toString(16).padStart(2, '0')).join('');

export function validateIccProfile(bytes: ArrayBuffer, options: IccValidationOptions = {}): Omit<IccProfileMetadata, 'sha256'> {
    if (bytes.byteLength < 132) throw new Error('ICC-filen er for lille til en gyldig profil.');
    if (bytes.byteLength > MAX_ICC_PROFILE_BYTES) throw new Error('ICC-filen må højst fylde 16 MB.');
    const view = new DataView(bytes);
    const data = new Uint8Array(bytes);
    if (view.getUint32(0) !== bytes.byteLength) throw new Error('ICC-filens angivne størrelse matcher ikke filen.');
    if (signatureAt(data, 36) !== 'acsp') throw new Error('Filen har ikke en gyldig ICC-signatur.');
    const major = data[8];
    if (major !== 2 && major !== 4) throw new Error('Kun ICC version 2 og 4 understøttes.');
    const deviceClass = signatureAt(data, 12);
    const colorSpace = signatureAt(data, 16).trim();
    const pcs = signatureAt(data, 20).trim();
    if (!['prtr', 'mntr', 'scnr', 'spac', 'link', 'abst', 'nmcl'].includes(deviceClass)) {
        throw new Error('ICC-profilens enhedsklasse er ukendt.');
    }
    if (pcs !== 'XYZ' && pcs !== 'Lab') throw new Error('ICC-profilens forbindelsesfarverum understøttes ikke.');
    if (options.expectedColorSpace && colorSpace !== options.expectedColorSpace) {
        throw new Error(`Profilen er ${colorSpace}, men denne funktion kræver ${options.expectedColorSpace}.`);
    }
    if (options.expectedClass && deviceClass !== options.expectedClass) {
        throw new Error(`Profilklassen ${deviceClass} passer ikke til den valgte rolle (${options.expectedClass}).`);
    }
    if (!options.expectedColorSpace && colorSpace !== 'CMYK' && colorSpace !== 'RGB') {
        throw new Error('Denne profiloversigt understøtter RGB og CMYK profiler.');
    }
    const tagCount = view.getUint32(128);
    const tableEnd = 132 + tagCount * 12;
    if (!tagCount || tagCount > 4096 || tableEnd > bytes.byteLength) throw new Error('ICC-profilens tagtabel er ugyldig.');
    const tags: Array<{ signature: string; offset: number; size: number }> = [];
    const signatures = new Set<string>();
    for (let index = 0; index < tagCount; index++) {
        const entry = 132 + index * 12;
        const signature = signatureAt(data, entry);
        const offset = view.getUint32(entry + 4);
        const size = view.getUint32(entry + 8);
        if (signatures.has(signature)) throw new Error('ICC-profilen indeholder gentagne tags.');
        signatures.add(signature);
        if (offset < tableEnd || offset % 4 !== 0 || size < 8 || size > bytes.byteLength - offset) {
            throw new Error('ICC-profilen indeholder et tag uden for filens datagrænser.');
        }
        tags.push({ signature, offset, size });
    }
    const sorted = [...tags].sort((a, b) => a.offset - b.offset || b.size - a.size);
    for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        // ICC allows multiple tags to share the exact same data block.
        if (current.offset < previous.offset + previous.size &&
            (current.offset !== previous.offset || current.size !== previous.size)) {
            throw new Error('ICC-profilens tagdata overlapper ugyldigt.');
        }
    }
    const descriptionTag = tags.find(tag => tag.signature === 'desc');
    let description: string | null = null;
    if (descriptionTag) {
        const { offset, size } = descriptionTag;
        const type = signatureAt(data, offset);
        if (type === 'desc' && size >= 12) {
            const length = view.getUint32(offset + 8);
            if (length > size - 12) throw new Error('ICC-profilens beskrivelse går ud over tagget.');
            description = new TextDecoder('utf-8').decode(data.subarray(offset + 12, offset + 12 + length)).replace(/\0.*$/s, '').slice(0, 500);
        } else if (type === 'mluc' && size >= 16) {
            const count = view.getUint32(offset + 8);
            const recordSize = view.getUint32(offset + 12);
            if (recordSize < 12 || count > 4096 || 16 + count * recordSize > size) throw new Error('ICC-profilens flersprogede beskrivelse er ugyldig.');
            for (let index = 0; index < count; index++) {
                const record = offset + 16 + index * recordSize;
                const length = view.getUint32(record + 4);
                const textOffset = view.getUint32(record + 8);
                if (length % 2 || textOffset < 16 + count * recordSize || textOffset > size || length > size - textOffset) {
                    throw new Error('ICC-profilens beskrivelsestekst går ud over tagget.');
                }
                if (!description || signatureAt(data, record).startsWith('en')) {
                    description = new TextDecoder('utf-16be').decode(data.subarray(offset + textOffset, offset + textOffset + length)).slice(0, 500);
                }
            }
        }
    }
    const embeddedId = hex(data.subarray(84, 100));
    return {
        version: `${major}.${data[9] >> 4}.${data[9] & 15}`,
        deviceClass, colorSpace, pcs, byteLength: bytes.byteLength, tagCount,
        description: description || null,
        profileId: /^0+$/.test(embeddedId) ? null : embeddedId,
    };
}

export async function inspectIccProfile(bytes: ArrayBuffer, options: IccValidationOptions = {}): Promise<IccProfileMetadata> {
    const metadata = validateIccProfile(bytes, options);
    const sha256 = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    if (options.expectedSha256 && sha256 !== options.expectedSha256.toLowerCase()) {
        throw new Error('ICC-profilens checksum matcher ikke den godkendte fil.');
    }
    return { ...metadata, sha256 };
}
