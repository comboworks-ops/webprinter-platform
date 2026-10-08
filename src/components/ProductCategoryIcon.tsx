import { FileText, FolderOpen, Bookmark, Image as ImageIcon, BookOpen, RectangleHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveProductIconKey, type ProductIconKey } from '@/lib/branding/productAssets';
import { IconPackProvider, useIconPack } from '@/components/icons/IconFamily';
import { LEGACY_ICON_PACKS } from '@/components/icons/legacyProductPacks';
import { resolveIconPack } from '@/lib/icons/registry';

interface ProductCategoryIconProps { slug: string; category?: string | null; packId?: string | null; className?: string; }
const ICON_MAP = { flyers: FileText, folders: FolderOpen, salesFolders: Bookmark, posters: ImageIcon, booklets: BookOpen, banners: RectangleHorizontal } as const satisfies Record<ProductIconKey, typeof FileText>;
export function ProductCategoryIcon({ slug, category, packId, className }: ProductCategoryIconProps) {
  const inherited = useIconPack();
  const selected = resolveIconPack(packId || inherited);
  const key = resolveProductIconKey(slug, category);
  const Icon = ICON_MAP[key];
  const legacy = LEGACY_ICON_PACKS.find(pack => pack.id === selected);
  return <span className={cn('inline-flex items-center justify-center shrink-0', selected === 'classic' ? 'text-muted-foreground' : 'text-current', className)} data-product-icon-family={selected}>
    <span className="inline-flex h-full w-full min-h-4 min-w-4 items-center justify-center">
      {legacy ? legacy.icons[key] : <IconPackProvider packId={selected}><Icon className="h-full w-full" /></IconPackProvider>}
    </span>
  </span>;
}
