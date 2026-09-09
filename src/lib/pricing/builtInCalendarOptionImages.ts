import celebrationsImage from "@/assets/product-options/calendar-fillings/celebrations.png";
import kinderMiniMixImage from "@/assets/product-options/calendar-fillings/kinder-mini-mix.png";
import lindtHelloImage from "@/assets/product-options/calendar-fillings/lindt-hello-mini-sticks.png";
import lindtLindorImage from "@/assets/product-options/calendar-fillings/lindt-lindor-balls.png";
import merciPetitsImage from "@/assets/product-options/calendar-fillings/merci-petits.png";
import milkaFavouritesImage from "@/assets/product-options/calendar-fillings/milka-favourites.png";
import ritterSportImage from "@/assets/product-options/calendar-fillings/ritter-sport-cubes.png";
import tobleroneMixImage from "@/assets/product-options/calendar-fillings/toblerone-mix.png";

const normalizeCalendarFillingName = (valueName: string) => valueName.toLocaleLowerCase("da-DK");

export type CalendarOptionArtworkLabel = {
  text: string;
  left: string;
  top: string;
  width: string;
  height: string;
};

/**
 * Local, transparent storefront cutouts for the imported multi advent calendar.
 * These deliberately override the older remote draft images, several of which
 * had a checkerboard or vignette baked into their pixels.
 */
export const getBuiltInCalendarOptionImage = (valueName: string): string | undefined => {
  const normalized = normalizeCalendarFillingName(valueName);

  if (normalized.includes("celebrations")) return celebrationsImage;
  if (normalized.includes("kinder")) return kinderMiniMixImage;
  if (normalized.includes("milka")) return milkaFavouritesImage;
  if (normalized.includes("merci")) return merciPetitsImage;
  if (normalized.includes("toblerone")) return tobleroneMixImage;
  if (normalized.includes("lindt") && normalized.includes("lindor")) return lindtLindorImage;
  if (normalized.includes("lindt") && normalized.includes("hello")) return lindtHelloImage;
  if (normalized.includes("ritter sport")) return ritterSportImage;

  return undefined;
};

/**
 * Covers English placeholder artwork in the clean supplier cutouts with a
 * small Danish customization marker. Generated cutouts without source text do
 * not need one.
 */
export const getBuiltInCalendarOptionArtworkLabel = (
  valueName: string,
): CalendarOptionArtworkLabel | undefined => {
  const normalized = normalizeCalendarFillingName(valueName);
  const text = "DIT DESIGN";

  if (normalized.includes("milka")) {
    return { text, left: "28%", top: "28%", width: "47%", height: "20%" };
  }
  if (normalized.includes("toblerone")) {
    return { text, left: "30%", top: "29%", width: "43%", height: "20%" };
  }
  if (normalized.includes("lindt") && normalized.includes("lindor")) {
    return { text, left: "14%", top: "13%", width: "43%", height: "15%" };
  }
  if (normalized.includes("ritter sport")) {
    return { text, left: "24%", top: "20%", width: "52%", height: "23%" };
  }

  return undefined;
};
