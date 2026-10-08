import { createContext, createElement, forwardRef, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { LucideIcon, LucideProps } from '@webprinter/lucide-base';
import { readIconFamily, loadIconFamily, subscribeIconFamilies, resolveIconPack, type IconTree } from '@/lib/icons/registry';

const IconPackContext = createContext('classic');
export function IconPackProvider({ packId, children }: { packId?: string | null; children: ReactNode }) {
  return <IconPackContext.Provider value={resolveIconPack(packId)}>{children}</IconPackContext.Provider>;
}
// This context API is intentionally shared with the compatibility icon factory.
// eslint-disable-next-line react-refresh/only-export-components
export function useIconPack() { return useContext(IconPackContext); }
function useFamilyData(id: string) {
  const data = useSyncExternalStore(subscribeIconFamilies, () => readIconFamily(id), () => undefined);
  useEffect(() => { void loadIconFamily(id).catch(() => { /* Keep the readable local fallback if a chunk cannot load. */ }); }, [id]);
  return data;
}
function renderTree([tag, props, children]: IconTree, index: number): ReactNode {
  return createElement(tag, { ...props, key: index }, children.map(renderTree));
}
const FALLBACK_STROKES: Record<string, number> = { bootstrap: 1.6, carbon: 1.4, fluent: 1.8, heroicons: 2.5, iconoir: 1.5, material: 2.5, phosphor: 1.8, tabler: 2, remix: 2.4, mingcute: 2.4, modern: 2.4, outline: 1.5, gradient: 2 };
/** Compatibility wrapper: preserves SVG props, refs, children, sizing and action meaning. */
// eslint-disable-next-line react-refresh/only-export-components
export function themedIcon(name: string, Base: LucideIcon): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps & { packId?: string | null }>(function FamilyIcon({ packId, size = 24, color = 'currentColor', className, children, absoluteStrokeWidth, strokeWidth, ...props }, ref) {
    const inherited = useIconPack();
    const selected = resolveIconPack(packId || inherited);
    const data = useFamilyData(selected);
    const drawing = data?.icons[data.mapping[name]];
    if (!drawing) return <Base ref={ref} size={size} color={color} className={className} absoluteStrokeWidth={absoluteStrokeWidth} strokeWidth={strokeWidth ?? FALLBACK_STROKES[selected] ?? 2}
      data-icon-family={selected} data-icon-name={name} data-icon-fallback={data ? 'semantic' : undefined} {...props}>{children}</Base>;
    return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox={`0 0 ${drawing.width} ${drawing.height}`} fill="none" color={color}
      className={`lucide lucide-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()} ${className || ''}`} aria-hidden={props['aria-label'] || props['aria-labelledby'] ? undefined : true}
      focusable="false" data-icon-family={selected} data-icon-name={name} data-icon-source={data.mapping[name]} {...props}>
      {drawing.nodes.map(renderTree)}{children}
    </svg>;
  });
  Icon.displayName = `Themed${name}`;
  return Icon;
}
