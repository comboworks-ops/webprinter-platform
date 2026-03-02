import { FileText, FolderOpen, Bookmark, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveProductIconKey, type ProductIconKey } from "@/lib/branding/productAssets";

interface ProductCategoryIconProps {
  slug: string;
  category?: string | null;
  packId?: string | null;
  className?: string;
}

const ICON_MAP = {
  flyers: FileText,
  folders: FolderOpen,
  salesFolders: Bookmark,
  posters: ImageIcon,
  booklets: FileText,
  banners: ImageIcon,
} as const satisfies Record<ProductIconKey, typeof FileText>;

function getPackClasses(packId: string): { container: string; icon: string; strokeWidth: number } {
  switch (packId) {
    case "modern":
      return {
        container: "rounded-md bg-primary/10 text-primary p-1",
        icon: "",
        strokeWidth: 2.2,
      };
    case "gradient":
      return {
        container: "rounded-md bg-gradient-to-br from-cyan-500 to-indigo-500 text-white p-1 shadow-sm",
        icon: "",
        strokeWidth: 2.1,
      };
    case "outline":
      return {
        container: "rounded-md border border-current/30 text-foreground/80 p-1",
        icon: "",
        strokeWidth: 1.6,
      };
    default:
      return {
        container: "text-muted-foreground",
        icon: "",
        strokeWidth: 2,
      };
  }
}

export function ProductCategoryIcon({
  slug,
  category,
  packId = "classic",
  className,
}: ProductCategoryIconProps) {
  const iconKey = resolveProductIconKey(slug, category);
  const Icon = ICON_MAP[iconKey];
  const packClasses = getPackClasses(packId);

  return (
    <span className={cn("inline-flex items-center justify-center shrink-0", packClasses.container, className)}>
      <Icon className={cn("h-4 w-4", packClasses.icon)} strokeWidth={packClasses.strokeWidth} />
    </span>
  );
}
