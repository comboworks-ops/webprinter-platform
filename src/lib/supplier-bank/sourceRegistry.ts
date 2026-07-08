import type { SupplierBankProductFamily } from "./types";

export type SupplierSourceUrlCandidate = {
  url: string;
  status: "candidate_needs_confirmation" | "official_candidate_needs_confirmation" | "confirmed_source_url" | "rejected";
  evidence: string;
};
export const SUPPLIER_BANK_PRODUCT_FAMILY_URL_CANDIDATES: Partial<
  Record<string, Partial<Record<SupplierBankProductFamily, SupplierSourceUrlCandidate[]>>>
> = {
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
