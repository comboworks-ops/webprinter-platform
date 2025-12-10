// Product image imports - ensures images are properly bundled
import bannerePng from "@/assets/products/bannere.png";
import beachflagPng from "@/assets/products/beachflag.png";
import displayplakaterPng from "@/assets/products/displayplakater.png";
import flyersPng from "@/assets/products/flyers.png";
import folderePng from "@/assets/products/foldere.png";
import foliePng from "@/assets/products/folie.png";
import haefterPng from "@/assets/products/haefter.png";
import klistermaerkerPng from "@/assets/products/klistermaerker.png";
import messeudstyrPng from "@/assets/products/messeudstyr.png";
import plakaterPng from "@/assets/products/plakater.png";
import salgsmapperPng from "@/assets/products/salgsmapper.png";
import skiltePng from "@/assets/products/skilte.png";
import visitkortPng from "@/assets/products/visitkort.png";

// Map slugs to their imported images
const productImageMap: Record<string, string> = {
  bannere: bannerePng,
  beachflag: beachflagPng,
  displayplakater: displayplakaterPng,
  flyers: flyersPng,
  foldere: folderePng,
  folie: foliePng,
  haefter: haefterPng,
  klistermærker: klistermaerkerPng,
  klistermaerker: klistermaerkerPng,
  messeudstyr: messeudstyrPng,
  plakater: plakaterPng,
  salgsmapper: salgsmapperPng,
  skilte: skiltePng,
  visitkort: visitkortPng,
};

/**
 * Get the product image URL with fallback to local assets
 * Priority: uploaded image_url > local asset by slug > placeholder
 */
export function getProductImage(
  slug: string,
  imageUrl?: string | null
): string {
  // If there's a valid uploaded image URL (from storage, not a local path)
  if (imageUrl && !imageUrl.includes('/src/assets/')) {
    return imageUrl;
  }

  // Use local asset based on slug
  const localImage = productImageMap[slug.toLowerCase()];
  if (localImage) {
    return localImage;
  }

  // Fallback placeholder
  return "/placeholder.svg";
}

/**
 * Get all available product images for admin sync
 */
export function getAllProductImages(): Record<string, string> {
  return { ...productImageMap };
}
