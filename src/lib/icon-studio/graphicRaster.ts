import type { StudioRecipe } from '../../../supabase/functions/_shared/iconStudioRecipe.ts';

export function needsGraphicFinish(recipe?: StudioRecipe) {
  return Boolean(recipe && ['flat','duotone','silhouette','outline'].includes(recipe.styleId)
    && ['none','duotone','breakout'].includes(recipe.treatmentId));
}

/** Enforce flat spot colours without changing the provider's geometry or adding artwork.
 * Run before logos; white paper stays filled in flat styles, while single-ink seams stay open.
 */
export function finishGraphicPixels(rgba: Uint8ClampedArray, recipe: StudioRecipe) {
  if (!needsGraphicFinish(recipe)) return rgba;
  const colours = recipe.palette.map(hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)));
  const singleInk = recipe.styleId === 'outline' || recipe.styleId === 'silhouette';
  const ink = colours[0];
  const whiteDistance = ink.reduce((sum,c)=>sum+(255-c)**2,0);
  for(let n=0;n<rgba.length;n+=4) {
    if(rgba[n+3]<=2) { rgba[n+3]=0; continue; }
    let colour=ink;
    if(singleInk) {
      // Native alpha can still contain white anti-aliasing matte/seams. Estimate
      // ink coverage against white only when the chosen ink has enough contrast.
      // White/light inks keep native alpha rather than erasing the user's artwork.
      if(whiteDistance>30000) {
        const coverage=Math.max(0,Math.min(1,ink.reduce((sum,c,i)=>sum+(255-rgba[n+i])*(255-c),0)/whiteDistance));
        rgba[n+3]=Math.round(rgba[n+3]*(coverage>.85?1:coverage));
        if(rgba[n+3]<=2) rgba[n+3]=0;
      }
    } else {
      const distance=(rgb:number[])=>rgb.reduce((sum,c,i)=>sum+(rgba[n+i]-c)**2,0);
      colour=distance(colours[0])<=distance(colours[1])?colours[0]:colours[1];
    }
    rgba[n]=colour[0];rgba[n+1]=colour[1];rgba[n+2]=colour[2];
  }
  return rgba;
}
