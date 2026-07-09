import type { SupplierBankProductFamily } from "./types";

export type SupplierSourceUrlCandidate = {
  url: string;
  status: "candidate_needs_confirmation" | "official_candidate_needs_confirmation" | "confirmed_source_url" | "rejected";
  evidence: string;
};

export const SUPPLIER_BANK_SUPPLIER_LIBRARY_FAMILIES: Partial<Record<string, SupplierBankProductFamily[]>> = {
  "wir-machen-druck": [
    "folders",
    "flyers",
    "sales_folders",
    "business_cards",
    "posters",
    "banners",
    "signs",
    "rollups",
    "stickers",
    "labels",
    "books",
    "letterheads",
  ],
};

export const SUPPLIER_BANK_PRODUCT_FAMILY_URL_CANDIDATES: Partial<
  Record<string, Partial<Record<SupplierBankProductFamily, SupplierSourceUrlCandidate[]>>>
> = {
  "wir-machen-druck": {
    flyers: [
      {
        url: "https://www.wir-machen-druck.de/flyer-faltblaetter%2Ccategory%2C9839.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for flyers og falzflyere; kilde-URL skal stadig have manuel option-shape review før extraction.",
      },
    ],
    folders: [
      {
        url: "https://www.wir-machen-druck.de/flyer-faltblaetter%2Ccategory%2C9839.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for flyer/folder; nuværende bank-slice dækker foldere, men den eksakte kildemapping skal stadig kunne reviewes.",
      },
    ],
    sales_folders: [
      {
        url: "https://www.wir-machen-druck.de/praesentationsmappen%2Ccategory%2C9418.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for præsentationsmapper; extraction og dansk normalisering er ikke implementeret endnu.",
      },
    ],
    business_cards: [
      {
        url: "https://www.wir-machen-druck.de/visitenkarten%2Ccategory%2C9179.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for visitkort; option shape og prisrækker kræver stadig dry preview.",
      },
    ],
    posters: [
      {
        url: "https://www.wir-machen-druck.de/plakate%2Ccategory%2C9176.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for plakater; de eksakte plakatvarianter kræver stadig source review.",
      },
    ],
    banners: [
      {
        url: "https://www.wir-machen-druck.de/extrem-guenstig-planen-drucken%2Ccategory%2C13424.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for bannere/planer; storformat-prismodellen skal reviewes før bank write.",
      },
    ],
    signs: [
      {
        url: "https://www.wir-machen-druck.de/schilder-plattendruck-plattendirektdruck-extrem-guenstig%2Ccategory%2C15829.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for skilte og pladetryk; materiale- og størrelsesmodellen kræver stadig dry preview.",
      },
    ],
    rollups: [
      {
        url: "https://www.wir-machen-druck.de/roll-ups-und-werbedisplays-guenstig-drucken%2Ccategory%2C29228.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for roll-ups/displays; hardware-varianter kræver separat review før import.",
      },
    ],
    stickers: [
      {
        url: "https://www.wir-machen-druck.de/etiketten-guenstig-drucken%2Ccategory%2C24047.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for etiketter/klistermærker med Aufkleber-varianter; split mellem klistermærker og etiketter kræver dry preview.",
      },
    ],
    labels: [
      {
        url: "https://www.wir-machen-druck.de/etiketten-guenstig-drucken%2Ccategory%2C24047.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for etiketter; rulle-, ark- og enkeltetiketmodeller kræver stadig dry preview.",
      },
    ],
    books: [
      {
        url: "https://www.wir-machen-druck.de/extrem-guenstig-broschueren-drucken%2Ccategory%2C13266.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for brochurer/kataloger; indbinding og sidetal kræver stadig dry preview.",
      },
    ],
    letterheads: [
      {
        url: "https://www.wir-machen-druck.de/briefpapier%2Ccategory%2C9466.html",
        status: "official_candidate_needs_confirmation",
        evidence: "Officiel WIRmachenDRUCK-kategori for brevpapir; papir- og formatrækker kræver stadig dry preview.",
      },
    ],
  },
  pixartprinting: {
    posters: [
      {
        url: "https://www.pixartprinting.com/poster-printing/large-format-posters/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart product-route candidate found during URL discovery; option shape and extractor profile are not confirmed.",
      },
      {
        url: "https://www.pixartprinting.com/poster-printing/custom-posters/",
        status: "official_candidate_needs_confirmation",
        evidence: "Alternative official Pixart poster route; choose only after manual option-shape review.",
      },
    ],
    banners: [
      {
        url: "https://www.pixartprinting.com/custom-banners/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart banner category/product route; exact PVC/banner configurator route still needs manual option-shape confirmation.",
      },
    ],
    rollups: [
      {
        url: "https://www.pixartprinting.com/custom-banners/retractable-banners/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart retractable-banner route; likely rollup family candidate but hardware/product shape must be confirmed.",
      },
      {
        url: "https://www.pixartprinting.com/custom-banners/retractable-banners/roll-up-banners/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart roll-up route candidate; confirm exact configurator behavior before profile work.",
      },
    ],
    labels: [
      {
        url: "https://www.pixartprinting.com/custom-labels/roll-labels/custom-roll-labels/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart custom roll-label route; exact label source and row model must be confirmed before extraction.",
      },
      {
        url: "https://www.pixartprinting.com/custom-labels/roll-labels/paper-labels/",
        status: "official_candidate_needs_confirmation",
        evidence: "Official Pixart paper-label route; possible narrower first slice after label option-shape review.",
      },
    ],
  },
};
