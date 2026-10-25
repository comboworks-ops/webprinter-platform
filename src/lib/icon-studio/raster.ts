import { cutoutStudioChroma } from './chroma';
import { finishGraphicPixels, needsGraphicFinish } from './graphicRaster';
import type { StudioRecipe } from '../../../supabase/functions/_shared/iconStudioRecipe';

export async function finishStudioGraphic(blob:Blob,size:number,recipe?:StudioRecipe) {
  if(!recipe || !needsGraphicFinish(recipe)) return blob;
  const url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Billedet kunne ikke klargøres.');
    ctx.drawImage(image,0,0,size,size);
    const pixels=ctx.getImageData(0,0,size,size);
    finishGraphicPixels(pixels.data,recipe);ctx.putImageData(pixels,0,0);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG kunne ikke oprettes.')),'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

export async function removeStudioChromaBackdrop(blob:Blob,size:number,hex:string) {
  const url=URL.createObjectURL(blob);
  try {
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Billedet kunne ikke klargøres.');
    ctx.drawImage(image,0,0,size,size);
    const pixels=ctx.getImageData(0,0,size,size);
    cutoutStudioChroma(pixels.data,size,size,hex);ctx.putImageData(pixels,0,0);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG kunne ikke oprettes.')),'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

/** Normalise export dimensions without claiming the provider generated at that size. */
export async function finishStudioRaster(blob: Blob, size: number, panelColour?: string) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Billedet kunne ikke klargøres.');
    if (panelColour) {
      ctx.fillStyle = panelColour;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(size * .22, size * .22, size * .56, size * .56);
      ctx.globalAlpha = 1;
    }
    const scale = size / Math.max(image.naturalWidth,image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    ctx.drawImage(image,(size-width)/2,(size-height)/2,width,height);
    const result = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG kunne ikke oprettes.')), 'image/png'));
    return { blob:result, nativeWidth:image.naturalWidth, nativeHeight:image.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}
