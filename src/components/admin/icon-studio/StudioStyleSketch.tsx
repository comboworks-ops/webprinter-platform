import { useId } from 'react';
import { studioStyle } from '../../../../supabase/functions/_shared/iconStudioRecipe.ts';

/** Authored UI sketches, deliberately labelled separately from generated imagery. */
export function StudioStyleSketch({ styleId, palette }: { styleId: string; palette?: readonly string[] }) {
  const id = useId().replace(/:/g,'');
  const style = studioStyle(styleId);
  const colour = palette?.[0] || style.colour;
  const line = ['outline','pencil','ink'].includes(styleId);
  const flat = ['flat','silhouette','duotone','screenprint'].includes(styleId);
  return <svg viewBox="0 0 160 110" aria-hidden="true" className={`studio-style-sketch studio-sketch-${styleId}`}>
    <defs>
      <linearGradient id={id} x2=".8" y2="1"><stop stopColor={colour}/><stop offset="1" stopColor={palette?.[1] || '#edf1f4'}/></linearGradient>
    </defs>
    <ellipse cx="83" cy="93" rx="45" ry="5" fill={colour} opacity={line || flat ? '.04' : '.14'}/>
    <path d="M38 20 99 11 126 31 126 86 62 98 38 78Z" fill={line ? 'none' : flat ? colour : `url(#${id})`} stroke={colour} strokeWidth={line ? 1.4 : .8} strokeDasharray={styleId === 'pencil' ? '3 1' : undefined} opacity={styleId === 'glass' ? .55 : 1}/>
    <path d="M38 20 62 40 126 31M62 40V98" fill="none" stroke={line ? colour : '#fff'} strokeWidth={styleId === 'ink' ? 2 : 1.3} opacity={styleId === 'silhouette' ? 0 : .85}/>
    <path d="m72 58 41-6v23l-41 7z" fill={line ? 'none' : '#fff'} stroke={line ? colour : 'none'} opacity={line ? 1 : .24}/>
    {['papercut','lowpoly'].includes(styleId) && <path d="m62 40 44 39-44 19Z" fill={colour} opacity=".25"/>}
    {['pencil','screenprint','kraft','metal'].includes(styleId) && [0,1,2,3,4].map(i => <path key={i} d={`m74 ${58+i*5} 35-6`} stroke={colour} opacity=".5"/>)}
    {styleId === 'photo3d' && <circle cx="127" cy="77" r="16" fill={palette?.[1] || '#c8adcf'} opacity=".85"/>}
  </svg>;
}
