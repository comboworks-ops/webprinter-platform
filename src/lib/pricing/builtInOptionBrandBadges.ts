import celebrationsLogo from "@/assets/product-options/calendar-brands/celebrations.png";
import kinderLogo from "@/assets/product-options/calendar-brands/kinder.png";
import lindtLogo from "@/assets/product-options/calendar-brands/lindt.png";
import merciLogo from "@/assets/product-options/calendar-brands/merci.png";
import milkaLogo from "@/assets/product-options/calendar-brands/milka.svg";
import ritterSportLogo from "@/assets/product-options/calendar-brands/ritter-sport.png";
import tobleroneLogo from "@/assets/product-options/calendar-brands/toblerone.svg";

export type OptionBrandBadge = {
  imageUrl: string;
  alt: string;
  variantLabel?: string;
  backgroundColor?: string;
  shape?: "square" | "wide";
};

const normalizeBrandName = (valueName: string) => valueName.toLocaleLowerCase("da-DK");

/**
 * Product-identification badges for imported branded fillings.
 * These stay separate from the customizable calendar artwork so the UI never
 * implies that a customer's print automatically includes the chocolate logo.
 */
export const getBuiltInOptionBrandBadge = (valueName: string): OptionBrandBadge | undefined => {
  const normalized = normalizeBrandName(valueName);

  if (normalized.includes("celebrations")) {
    return {
      imageUrl: celebrationsLogo,
      alt: "Celebrations",
      backgroundColor: "#D92521",
      shape: "square",
    };
  }
  if (normalized.includes("kinder")) {
    return { imageUrl: kinderLogo, alt: "Kinder", backgroundColor: "#FFFFFF", shape: "wide" };
  }
  if (normalized.includes("milka")) {
    return { imageUrl: milkaLogo, alt: "Milka", backgroundColor: "#7655A6", shape: "wide" };
  }
  if (normalized.includes("merci")) {
    return { imageUrl: merciLogo, alt: "merci", backgroundColor: "#FFFFFF", shape: "wide" };
  }
  if (normalized.includes("toblerone")) {
    return { imageUrl: tobleroneLogo, alt: "Toblerone", backgroundColor: "#FFFFFF", shape: "wide" };
  }
  if (normalized.includes("lindt")) {
    return {
      imageUrl: lindtLogo,
      alt: normalized.includes("lindor") ? "Lindt LINDOR" : "Lindt HELLO",
      variantLabel: normalized.includes("lindor") ? "LINDOR" : normalized.includes("hello") ? "HELLO" : undefined,
      backgroundColor: "#FFFDF7",
      shape: "wide",
    };
  }
  if (normalized.includes("ritter sport")) {
    return {
      imageUrl: ritterSportLogo,
      alt: "Ritter Sport",
      backgroundColor: "#FFFFFF",
      shape: "square",
    };
  }

  return undefined;
};
