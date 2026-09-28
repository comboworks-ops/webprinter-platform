import { graphicGuideLessons } from "./graphicGuideLessons";
import { supabase } from "@/integrations/supabase/client";

export type GraphicGuideLessonEdit = {
  label: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  labels: [string, string];
  tips: [{ title: string; text: string }, { title: string; text: string }];
  note: string;
};

export type GraphicGuideSettings = {
  heading: string;
  introduction: string;
  navHeading: string;
  navNote: string;
  templateText: string;
  detailIntro: string;
  detailHeading: string;
  templateHeading: string;
  helpText: string;
  detailSections: Record<string, { title: string; body: string }>;
  lessons: Record<string, GraphicGuideLessonEdit>;
};

export const graphicGuideDetailSections = [
  { id: "offsettryk", title: "Offsettryk (flyers, foldere, salgsmapper, plakater)" },
  { id: "cmyk-rgb", title: "CMYK vs RGB + Farveforventninger" },
  { id: "storformat", title: "Storformat / Wide-format" },
  { id: "efterbehandling", title: "Efterbehandling af Bannere" },
  { id: "spotlak", title: "Specielle Effekter (Spotlak, Folie, CutContour, Hvidt Blæk)" },
  { id: "trykmetoder", title: "Silketryk vs Digitaltryk" },
  { id: "tekstiltryk", title: "Tekstiltryk: DTG & DTF (tøjtryk)" },
  { id: "pdf-eksport", title: "Sådan Eksporterer du en Korrekt PDF" },
] as const;

export const graphicGuideDefaults: GraphicGuideSettings = {
  heading: "Gør din fil klar til tryk.",
  introduction: "Fem enkle trin. Se forskellen, og undgå de typiske fejl.",
  navHeading: "Hvad vil du tjekke?",
  navNote: "Vælg et emne, eller følg guiden trin for trin.",
  templateText: "Vælg først produkt og format. På produktsiden finder du den tilknyttede skabelon, når der er en til produktet. Her står de præcise mål, bleed og sikkerhedsafstand.",
  detailIntro: "Find den udførlige vejledning her. Kravene i din produktskabelon gælder altid frem for de generelle eksempler.",
  templateHeading: "Find den rigtige skabelon",
  detailHeading: "Storformat, tekstil og særlige filkrav",
  helpText: "I tvivl om din fil?",
  detailSections: Object.fromEntries(graphicGuideDetailSections.map((section) => [section.id, { title: section.title, body: "" }])),
  lessons: Object.fromEntries(graphicGuideLessons.map((lesson) => [lesson.id, {
    label: lesson.label,
    title: lesson.title,
    description: lesson.description,
    imageUrl: "",
    imageAlt: lesson.imageAlt,
    labels: [...lesson.labels],
    tips: lesson.tips.map((tip) => ({ ...tip })),
    note: lesson.note,
  }])) as Record<string, GraphicGuideLessonEdit>,
};

const stringOr = (value: unknown, fallback: string) => typeof value === "string" ? value : fallback;

/** Ignore unknown keys and keep built-in examples for shops with no saved guide. */
export function resolveGraphicGuideSettings(value: unknown): GraphicGuideSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const sourceLessons = source.lessons && typeof source.lessons === "object" ? source.lessons as Record<string, unknown> : {};
  const sourceDetailSections = source.detailSections && typeof source.detailSections === "object" ? source.detailSections as Record<string, unknown> : {};
  const lessons = Object.fromEntries(graphicGuideLessons.map(({ id }) => {
    const fallback = graphicGuideDefaults.lessons[id];
    const raw = sourceLessons[id] && typeof sourceLessons[id] === "object" ? sourceLessons[id] as Record<string, unknown> : {};
    const labels = Array.isArray(raw.labels) ? raw.labels : [];
    const tips = Array.isArray(raw.tips) ? raw.tips : [];
    return [id, {
      label: stringOr(raw.label, fallback.label),
      title: stringOr(raw.title, fallback.title),
      description: stringOr(raw.description, fallback.description),
      imageUrl: stringOr(raw.imageUrl, fallback.imageUrl),
      imageAlt: stringOr(raw.imageAlt, fallback.imageAlt),
      labels: [stringOr(labels[0], fallback.labels[0]), stringOr(labels[1], fallback.labels[1])],
      tips: fallback.tips.map((tip, index) => ({
        title: stringOr(tips[index]?.title, tip.title),
        text: stringOr(tips[index]?.text, tip.text),
      })),
      note: stringOr(raw.note, fallback.note),
    }];
  })) as Record<string, GraphicGuideLessonEdit>;
  return {
    heading: stringOr(source.heading, graphicGuideDefaults.heading),
    introduction: stringOr(source.introduction, graphicGuideDefaults.introduction),
    navHeading: stringOr(source.navHeading, graphicGuideDefaults.navHeading),
    navNote: stringOr(source.navNote, graphicGuideDefaults.navNote),
    templateText: stringOr(source.templateText, graphicGuideDefaults.templateText),
    detailIntro: stringOr(source.detailIntro, graphicGuideDefaults.detailIntro),
    templateHeading: stringOr(source.templateHeading, graphicGuideDefaults.templateHeading),
    detailHeading: stringOr(source.detailHeading, graphicGuideDefaults.detailHeading),
    helpText: stringOr(source.helpText, graphicGuideDefaults.helpText),
    detailSections: Object.fromEntries(graphicGuideDetailSections.map(({ id, title }) => {
      const raw = sourceDetailSections[id] && typeof sourceDetailSections[id] === "object" ? sourceDetailSections[id] as Record<string, unknown> : {};
      return [id, { title: stringOr(raw.title, title), body: stringOr(raw.body, "") }];
    })),
    lessons,
  };
}

export function graphicGuideImageSrc(imageUrl: string, fallbackName: string): string {
  if (!imageUrl) return `/images/graphic-guidance/${fallbackName}`;
  try {
    const url = new URL(imageUrl);
    const expected = new URL(supabase.storage.from("product-images").getPublicUrl("branding/").data.publicUrl);
    if (url.origin === expected.origin && url.pathname.startsWith(expected.pathname)) return url.href;
  } catch { /* Retain the built-in image for malformed saved URLs. */ }
  return `/images/graphic-guidance/${fallbackName}`;
}
