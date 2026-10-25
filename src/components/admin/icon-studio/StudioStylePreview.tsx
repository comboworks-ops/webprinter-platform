import { memo, useId } from 'react';
import { studioStyle } from '../../../../supabase/functions/_shared/iconStudioRecipe.ts';
import { getIconStudioProductLabel, type IconStudioProductKey } from '@/lib/icon-studio/catalog';
import { PRODUCT_ILLUSTRATIONS, type ProductIllustration } from '@/lib/icon-studio/productIllustrations';

interface Props {
  styleId: string;
  productKey: IconStudioProductKey;
  palette: readonly [string, string];
  thumbnail?: boolean;
}

/** Local SVG only: selecting products, styles or colours cannot start a provider request. */
export const StudioStylePreview = memo(function StudioStylePreview({ styleId, productKey, palette, thumbnail = false }: Props) {
  const id = `studio-${useId().replace(/:/g, '')}`;
  const ref = (name: string) => `url(#${id}-${name})`;
  const style = studioStyle(styleId);
  const shape: ProductIllustration = PRODUCT_ILLUSTRATIONS[productKey];
  const primary = /^#[0-9a-f]{6}$/i.test(palette[0]) ? palette[0] : '#145f6d';
  const secondary = /^#[0-9a-f]{6}$/i.test(palette[1]) ? palette[1] : '#f9f2e4';
  const line = ['outline', 'pencil', 'ink'].includes(styleId);
  const graphic = ['flat', 'silhouette', 'duotone', 'screenprint'].includes(styleId);
  const photographic = ['photo', 'daylight', 'exclusive', 'photo3d'].includes(styleId);
  const dark = styleId === 'exclusive' || [1, 3, 5].reduce((sum, start) => sum + parseInt(primary.slice(start, start + 2), 16), 0) > 650;
  const background = dark ? '#293540' : styleId === 'daylight' ? '#f2e9d8' : '#f5f3ee';
  const ink = styleId === 'pencil' ? '#726c63' : styleId === 'ink' ? '#253540' : primary;
  const textured = ['pencil', 'ink', 'watercolour', 'screenprint', 'kraft', 'metal'].includes(styleId);
  const width = styleId === 'outline' ? 1.3 : styleId === 'pencil' ? 1 : styleId === 'ink' ? 2.7 : 1.2;
  const fill = line ? 'none' : styleId === 'silhouette' ? primary : styleId === 'kraft' ? '#c7a374'
    : photographic ? ref('paper') : ['clay', 'animation', 'studio3d', 'glass', 'metal'].includes(styleId) ? ref('surface') : secondary;
  const artwork = shape.artwork;
  const shadow = !line && !graphic && styleId !== 'watercolour';
  return <svg className="studio-style-image studio-product-illustration" viewBox="0 0 240 240" width="240" height="240"
    role={thumbnail ? undefined : 'img'} aria-hidden={thumbnail ? true : undefined}
    aria-label={thumbnail ? undefined : `${getIconStudioProductLabel(productKey)} · ${style.label} · gratis illustration`}
    data-preview-product={productKey} data-preview-style={styleId} focusable="false">
    <defs>
      <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="1">
        {styleId === 'metal' ? <><stop stopColor="#f8fafc"/><stop offset=".24" stopColor="#687785"/><stop offset=".48" stopColor="#eef2f5"/><stop offset=".62" stopColor="#8c99a4"/><stop offset="1" stopColor="#d7dde2"/></>
          : <><stop stopColor={secondary} stopOpacity={styleId === 'glass' ? .24 : 1}/><stop offset={styleId === 'animation' ? '.42' : '1'} stopColor={primary} stopOpacity={styleId === 'glass' ? .36 : 1}/>{styleId === 'animation' && <stop offset="1" stopColor="#233645"/>}</>}
      </linearGradient>
      <linearGradient id={`${id}-paper`} x2="1" y2=".7"><stop stopColor={styleId === 'daylight' ? '#fff6df' : '#ffffff'}/><stop offset=".65" stopColor={secondary}/><stop offset="1" stopColor={styleId === 'exclusive' ? '#72808a' : '#d9dddc'}/></linearGradient>
      <radialGradient id={`${id}-wash`}><stop stopColor={primary} stopOpacity=".8"/><stop offset=".6" stopColor={primary} stopOpacity=".42"/><stop offset="1" stopColor={secondary} stopOpacity=".1"/></radialGradient>
      <pattern id={`${id}-texture`} width={styleId === 'screenprint' ? 4 : 7} height={styleId === 'screenprint' ? 4 : 7} patternUnits="userSpaceOnUse" patternTransform={styleId === 'metal' ? 'rotate(12)' : 'rotate(-25)'}>
        {['screenprint', 'watercolour', 'kraft'].includes(styleId) ? <><circle cx="1" cy="1" r={styleId === 'screenprint' ? .8 : .55} fill={ink}/><circle cx="5" cy="4" r=".35" fill={ink}/></> : <path d="M0 1H7M2 4H6" stroke={ink} strokeWidth={styleId === 'metal' ? '.45' : '.7'}/>}
      </pattern>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="175%"><feDropShadow dx={styleId === 'daylight' ? 10 : 3} dy={styleId === 'daylight' ? 12 : 6} stdDeviation={styleId === 'papercut' ? 1 : 4} floodColor="#182c3c" floodOpacity=".23"/></filter>
      <clipPath id={`${id}-product`}>{shape.surfaces.map((d, i) => <path key={i} d={d} clipRule="evenodd"/>)}</clipPath>
      {artwork && <clipPath id={`${id}-art`}><rect x={artwork[0]} y={artwork[1]} width={artwork[2]} height={artwork[3]}/></clipPath>}
    </defs>
    <rect width="240" height="240" rx="8" fill={background}/>
    {styleId === 'photo3d' && <><circle cx="174" cy="70" r="43" fill={primary} opacity=".36"/><circle cx="55" cy="172" r="26" fill={secondary} stroke={primary} strokeWidth="7"/></>}
    {styleId === 'glass' && <><circle cx="82" cy="90" r="38" fill={primary} opacity=".16"/><circle cx="163" cy="156" r="46" fill={primary} opacity=".13"/></>}
    {['papercut', 'studio3d'].includes(styleId) && <g transform={styleId === 'papercut' ? 'translate(5 6)' : 'translate(2 3)'} fill={primary} opacity=".55">{shape.surfaces.map((d, i) => <path key={i} d={d} fillRule="evenodd"/>)}</g>}
    <g filter={shadow ? ref('shadow') : undefined}>
      {shape.surfaces.map((d, i) => <path key={i} d={d} fillRule="evenodd" fill={fill}
        stroke={line ? ink : styleId === 'glass' ? '#ffffff' : primary} strokeWidth={width}
        strokeLinejoin="round" opacity={styleId === 'watercolour' ? .65 : 1}/>) }
    </g>
    <g clipPath={ref('product')}>
      {styleId === 'watercolour' && <><ellipse cx="90" cy="110" rx="100" ry="90" fill={ref('wash')}/><ellipse cx="160" cy="158" rx="70" ry="65" fill={ref('wash')}/></>}
      {styleId === 'lowpoly' && <g fill={primary}><path d="M0 0L240 70L60 137Z" opacity=".8"/><path d="M240 70L60 137L240 240Z" opacity=".35"/><path d="M60 137L0 240H240Z" opacity=".6"/></g>}
      {styleId === 'duotone' && <path d="M0 155L240 65V240H0Z" fill={primary}/>}
      {styleId === 'screenprint' && <path d="M0 186L240 79V160L0 235Z" fill={primary} opacity=".25"/>}
      {textured && <rect x="20" y="20" width="200" height="200" fill={ref('texture')} opacity={styleId === 'screenprint' ? .5 : styleId === 'pencil' ? .3 : .18}/>}
      {styleId === 'animation' && <path d="M36 42Q103 20 187 43" fill="none" stroke="#fff" strokeWidth="9" opacity=".65" strokeLinecap="round"/>}
      {styleId === 'glass' && <path d="M60 30L175 211M84 26L199 207" stroke="#fff" strokeWidth="8" opacity=".35"/>}
      {artwork && styleId !== 'silhouette' && <g clipPath={ref('art')} transform={styleId === 'screenprint' ? 'translate(1.5 1)' : undefined}>
        <circle cx={artwork[0] + artwork[2] * .76} cy={artwork[1] + artwork[3] * .27} r={Math.min(artwork[2], artwork[3]) * .3}
          fill={line ? 'none' : primary} stroke={ink} strokeWidth={width} opacity={styleId === 'watercolour' ? .55 : .9}/>
        <path d={`M${artwork[0]} ${artwork[1] + artwork[3] * .68}l${artwork[2] * .48} -${artwork[3] * .4}l${artwork[2] * .62} ${artwork[3] * .4}v${artwork[3] * .12}H${artwork[0]}Z`}
          fill={line ? 'none' : primary} stroke={ink} strokeWidth={width} opacity={styleId === 'duotone' ? 1 : .65}/>
        <path d={`M${artwork[0]} ${artwork[1] + artwork[3] * .9}h${artwork[2] * .8}m-${artwork[2] * .8} ${Math.max(3, artwork[3] * .07)}h${artwork[2] * .5}`}
          stroke={line ? ink : primary} strokeWidth={line ? width : 2.5} strokeLinecap="round"/>
      </g>}
    </g>
    {shape.seams && <path d={shape.seams} fill="none" stroke={styleId === 'silhouette' ? background : line ? ink : primary}
      strokeWidth={styleId === 'silhouette' ? 2.6 : width} strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>;
});
