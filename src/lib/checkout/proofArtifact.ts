export interface ProofArtifactInput {
  fileUrl: string;
  filePath: string;
  sha256: string;
  fileType: 'image' | 'pdf';
  designerExport: boolean;
  physicalWidthMm: number;
  physicalHeightMm: number;
  targetWidthMm: number;
  targetHeightMm: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Direct payment accepts only bytes that already represent the displayed placement.
 * The existing Designer export bakes edited placements into a production file. */
export function requiresProofExport(input: ProofArtifactInput): boolean {
  if (!input.fileUrl || !input.filePath || !/^[a-f0-9]{64}$/.test(input.sha256)) return true;
  if (![input.scale, input.offsetX, input.offsetY, input.targetWidthMm, input.targetHeightMm,
    input.physicalWidthMm, input.physicalHeightMm].every(Number.isFinite)) return true;
  if (input.targetWidthMm <= 0 || input.targetHeightMm <= 0) return true;
  if (Math.abs(input.scale - 100) > 0.001 || Math.abs(input.offsetX) > 0.001 || Math.abs(input.offsetY) > 0.001) return true;
  if (input.designerExport) return false;
  return input.fileType !== 'pdf'
    || Math.abs(input.physicalWidthMm - input.targetWidthMm) > 0.1
    || Math.abs(input.physicalHeightMm - input.targetHeightMm) > 0.1;
}

export function proofArtifactFingerprint(input: ProofArtifactInput): string {
  return JSON.stringify(input);
}

export function primaryProductionFiles<T extends { isPrimary?: boolean | null }>(files: T[]): T[] {
  return [...files].sort((left, right) => Number(right.isPrimary === true) - Number(left.isPrimary === true));
}
