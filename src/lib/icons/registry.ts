import families from './families.json';

export type IconTree = [string, Record<string, string>, IconTree[]];
export type IconDrawing = { nodes: IconTree[]; width: number; height: number };
export type IconFamilyData = { icons: Record<string, IconDrawing>; mapping: Record<string, string> };
export const ICON_FAMILIES = families;
export const LEGACY_ICON_IDS = ['classic', 'modern', 'gradient', 'outline'] as const;
export function resolveIconPack(value?: string | null): string {
  return ICON_FAMILIES.some(family => family.id === value) || LEGACY_ICON_IDS.some(id => id === value) ? value! : 'classic';
}
const loaders = import.meta.glob<{ default: IconFamilyData }>('./data/*.json');
const cache = new Map<string, IconFamilyData>();
const pending = new Map<string, Promise<IconFamilyData>>();
const listeners = new Set<() => void>();
export function subscribeIconFamilies(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function readIconFamily(id: string) { return cache.get(id); }
export function loadIconFamily(id: string): Promise<IconFamilyData | undefined> {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (pending.has(id)) return pending.get(id)!;
  const loader = loaders[`./data/${id}.json`];
  if (!loader) return Promise.resolve(undefined);
  const request = loader().then(module => {
    cache.set(id, module.default);
    listeners.forEach(listener => listener());
    return module.default;
  }).catch(error => { pending.delete(id); throw error; });
  pending.set(id, request);
  return request;
}
