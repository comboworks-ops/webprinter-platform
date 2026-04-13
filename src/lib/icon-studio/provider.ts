import {
  getIconStudioBrandFinishLabel,
  getIconStudioPlacementPresets,
  getIconStudioProductLabel,
  getIconStudioStyleLabel,
  getIconStudioVariantLabel,
  type IconStudioBrandFinishKey,
  type IconStudioPlacementPresetKey,
  type IconStudioProductKey,
  type IconStudioStyleKey,
  type IconStudioVariantKey,
} from "./catalog";
import type {
  IconStudioBrandAssetRow,
  IconStudioGenerationPayload,
  IconStudioReferenceAssetRow,
} from "./types";

export interface IconStudioProviderDraft {
  label: string;
  extension: "png" | "svg";
  contentType: string;
  blob: Blob;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
}

export interface IconStudioReferenceImageInput {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface IconStudioGenerateDraftsInput {
  payload: IconStudioGenerationPayload;
  brandAsset: IconStudioBrandAssetRow | null;
  brandAssetDataUrl: string | null;
  referenceAssets: IconStudioReferenceAssetRow[];
  referenceImages: IconStudioReferenceImageInput[];
}

export interface IconStudioProvider {
  key: string;
  generateDrafts(input: IconStudioGenerateDraftsInput): Promise<IconStudioProviderDraft[]>;
}

export const ICON_STUDIO_PROVIDER_OPTIONS = [
  { key: "auto", label: "Auto" },
  { key: "mock", label: "Mock / Deterministisk" },
  { key: "gemini", label: "Gemini Image" },
  { key: "openai", label: "OpenAI Image" },
] as const;

export type IconStudioProviderPreference = (typeof ICON_STUDIO_PROVIDER_OPTIONS)[number]["key"];
export type IconStudioResolvedProviderKey =
  | "mock-icon-studio-v1"
  | "gemini-image-v1"
  | "openai-image-v1";

type StylePalette = {
  surface: string;
  stroke: string;
  accent: string;
  accentAlt: string;
  shadow: string;
  text: string;
  texture: string;
  background: string;
};

const STYLE_PALETTES: Record<IconStudioStyleKey, StylePalette> = {
  flat_clean: {
    surface: "#f8fafc",
    stroke: "#0f172a",
    accent: "#0f766e",
    accentAlt: "#134e4a",
    shadow: "rgba(15, 23, 42, 0.08)",
    text: "#0f172a",
    texture: "rgba(15, 118, 110, 0.08)",
    background: "rgba(15, 23, 42, 0.025)",
  },
  outline_technical: {
    surface: "transparent",
    stroke: "#1d4ed8",
    accent: "#0f172a",
    accentAlt: "#2563eb",
    shadow: "rgba(37, 99, 235, 0.08)",
    text: "#0f172a",
    texture: "rgba(37, 99, 235, 0.1)",
    background: "rgba(37, 99, 235, 0.02)",
  },
  soft_3d: {
    surface: "#eef2ff",
    stroke: "#312e81",
    accent: "#4f46e5",
    accentAlt: "#7c3aed",
    shadow: "rgba(79, 70, 229, 0.18)",
    text: "#1f2937",
    texture: "rgba(99, 102, 241, 0.12)",
    background: "rgba(99, 102, 241, 0.03)",
  },
  print_material_realistic: {
    surface: "#f5f2eb",
    stroke: "#57534e",
    accent: "#d97706",
    accentAlt: "#92400e",
    shadow: "rgba(120, 113, 108, 0.18)",
    text: "#292524",
    texture: "rgba(146, 64, 14, 0.08)",
    background: "rgba(120, 113, 108, 0.03)",
  },
  brand_custom: {
    surface: "#ffffff",
    stroke: "#111827",
    accent: "#dc2626",
    accentAlt: "#991b1b",
    shadow: "rgba(17, 24, 39, 0.14)",
    text: "#111827",
    texture: "rgba(220, 38, 38, 0.1)",
    background: "rgba(220, 38, 38, 0.02)",
  },
};

const ANCHOR_BOXES: Record<IconStudioPlacementPresetKey, { x: number; y: number; width: number; height: number }> = {
  front_upper_right: { x: 682, y: 168, width: 180, height: 120 },
  front_center: { x: 422, y: 336, width: 180, height: 120 },
  front_lower_left: { x: 174, y: 554, width: 180, height: 120 },
  lower_left: { x: 154, y: 624, width: 200, height: 112 },
  spine_center: { x: 96, y: 340, width: 96, height: 208 },
  banner_top: { x: 416, y: 120, width: 190, height: 114 },
  banner_center: { x: 422, y: 394, width: 180, height: 120 },
  label_center: { x: 428, y: 384, width: 168, height: 112 },
};

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getProductFamily(productKey: IconStudioProductKey) {
  if (
    [
      "business_card",
      "folded_business_card",
      "flyer",
      "leaflet",
      "poster",
      "menu_card",
      "postcard",
      "invitation_card",
      "ticket",
    ].includes(productKey)
  ) {
    return "sheet";
  }

  if (["presentation_folder", "document_folder"].includes(productKey)) {
    return "folder";
  }

  if (["brochure", "booklet", "softcover_book", "hardcover_book"].includes(productKey)) {
    return "book";
  }

  if (productKey === "envelope") {
    return "envelope";
  }

  if (["sticker", "product_label", "hang_tag", "badge"].includes(productKey)) {
    return "label";
  }

  if (["rollup_banner", "pvc_banner", "mesh_banner", "textile_banner", "beach_flag"].includes(productKey)) {
    return "banner";
  }

  if (productKey === "calendar") {
    return "calendar";
  }

  return "sheet";
}

function renderSurface(styleKey: IconStudioStyleKey, palette: StylePalette, draftIndex: number) {
  if (styleKey === "outline_technical") {
    return {
      fill: "none",
      stroke: palette.stroke,
      strokeWidth: 7,
      filter: "",
      opacity: 1,
    };
  }

  return {
    fill: `url(#surfaceGradient-${draftIndex})`,
    stroke: palette.stroke,
    strokeWidth: 3,
    filter: 'filter="url(#shadow)"',
    opacity: 1,
  };
}

function renderSheetGeometry(
  variantKey: IconStudioVariantKey,
  surface: ReturnType<typeof renderSurface>,
) {
  if (variantKey === "angled_front") {
    return `<polygon points="250,210 760,160 820,700 300,760" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />`;
  }

  if (variantKey === "stacked") {
    return `
      <rect x="248" y="200" width="440" height="560" rx="26" fill="rgba(15,23,42,0.07)" />
      <rect x="282" y="170" width="440" height="560" rx="26" fill="rgba(15,23,42,0.05)" />
      <rect x="318" y="138" width="440" height="560" rx="26" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    `;
  }

  if (variantKey === "top_view") {
    return `<rect x="174" y="290" width="676" height="380" rx="34" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />`;
  }

  return `<rect x="226" y="150" width="572" height="692" rx="28" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />`;
}

function renderFolderGeometry(
  variantKey: IconStudioVariantKey,
  surface: ReturnType<typeof renderSurface>,
  palette: StylePalette,
) {
  if (variantKey === "open") {
    return `
      <path d="M176 224 L476 170 L494 760 L214 800 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <path d="M514 170 L828 224 L786 800 L506 760 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <line x1="500" y1="156" x2="500" y2="788" stroke="${palette.accent}" stroke-width="6" stroke-dasharray="16 12" />
    `;
  }

  return `
    <path d="M196 230 L784 180 L834 780 L222 826 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <path d="M196 620 Q512 540 834 620" fill="none" stroke="${palette.accent}" stroke-width="8" />
  `;
}

function renderBookGeometry(
  variantKey: IconStudioVariantKey,
  surface: ReturnType<typeof renderSurface>,
  palette: StylePalette,
) {
  if (variantKey === "open") {
    return `
      <path d="M152 264 Q332 180 480 250 L480 786 Q330 720 152 810 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <path d="M544 250 Q692 180 872 264 L872 810 Q694 720 544 786 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <line x1="512" y1="220" x2="512" y2="804" stroke="${palette.accentAlt}" stroke-width="10" />
    `;
  }

  return `
    <rect x="248" y="140" width="520" height="708" rx="24" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <rect x="208" y="140" width="72" height="708" rx="18" fill="${palette.accentAlt}" opacity="0.9" />
  `;
}

function renderEnvelopeGeometry(surface: ReturnType<typeof renderSurface>, palette: StylePalette) {
  return `
    <path d="M176 294 L846 294 L786 732 L236 732 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <path d="M176 294 L512 548 L846 294" fill="none" stroke="${palette.accent}" stroke-width="8" />
    <path d="M236 732 L512 506 L786 732" fill="none" stroke="${palette.accentAlt}" stroke-width="8" opacity="0.6" />
  `;
}

function renderLabelGeometry(
  productKey: IconStudioProductKey,
  variantKey: IconStudioVariantKey,
  surface: ReturnType<typeof renderSurface>,
  palette: StylePalette,
) {
  if (productKey === "badge") {
    return `<circle cx="512" cy="512" r="268" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />`;
  }

  if (variantKey === "hanging" || productKey === "hang_tag") {
    return `
      <path d="M282 178 L734 178 L828 338 L698 844 L326 844 L196 338 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <circle cx="512" cy="270" r="34" fill="none" stroke="${palette.accent}" stroke-width="8" />
    `;
  }

  return `
    <rect x="196" y="242" width="632" height="542" rx="96" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <path d="M734 242 Q790 298 790 354 Q734 316 684 316 Q734 276 734 242 Z" fill="${palette.texture}" />
  `;
}

function renderBannerGeometry(
  productKey: IconStudioProductKey,
  variantKey: IconStudioVariantKey,
  surface: ReturnType<typeof renderSurface>,
  palette: StylePalette,
) {
  if (variantKey === "rolled") {
    return `
      <rect x="226" y="402" width="572" height="180" rx="90" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <circle cx="256" cy="492" r="90" fill="none" stroke="${palette.accentAlt}" stroke-width="18" />
    `;
  }

  if (productKey === "beach_flag") {
    return `
      <path d="M384 146 Q674 122 700 420 Q610 506 628 798 L448 822 Q430 578 520 470 Q442 382 384 146 Z" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
      <line x1="408" y1="126" x2="408" y2="868" stroke="${palette.accentAlt}" stroke-width="10" />
      <path d="M408 868 L332 924 L476 924 Z" fill="${palette.accentAlt}" />
    `;
  }

  return `
    <rect x="372" y="126" width="280" height="646" rx="18" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <line x1="512" y1="126" x2="512" y2="880" stroke="${palette.accentAlt}" stroke-width="10" />
    <path d="M420 880 L604 880 L670 924 L354 924 Z" fill="${palette.accentAlt}" opacity="0.7" />
  `;
}

function renderCalendarGeometry(surface: ReturnType<typeof renderSurface>, palette: StylePalette) {
  return `
    <rect x="214" y="198" width="596" height="624" rx="24" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${surface.strokeWidth}" ${surface.filter} />
    <rect x="214" y="198" width="596" height="126" rx="24" fill="${palette.accent}" opacity="0.18" />
    <circle cx="346" cy="198" r="26" fill="${palette.accentAlt}" />
    <circle cx="512" cy="198" r="26" fill="${palette.accentAlt}" />
    <circle cx="678" cy="198" r="26" fill="${palette.accentAlt}" />
  `;
}

function renderProductGeometry(
  productKey: IconStudioProductKey,
  variantKey: IconStudioVariantKey,
  styleKey: IconStudioStyleKey,
  draftIndex: number,
) {
  const palette = STYLE_PALETTES[styleKey];
  const surface = renderSurface(styleKey, palette, draftIndex);
  const family = getProductFamily(productKey);

  switch (family) {
    case "folder":
      return renderFolderGeometry(variantKey, surface, palette);
    case "book":
      return renderBookGeometry(variantKey, surface, palette);
    case "envelope":
      return renderEnvelopeGeometry(surface, palette);
    case "label":
      return renderLabelGeometry(productKey, variantKey, surface, palette);
    case "banner":
      return renderBannerGeometry(productKey, variantKey, surface, palette);
    case "calendar":
      return renderCalendarGeometry(surface, palette);
    default:
      return renderSheetGeometry(variantKey, surface);
  }
}

function renderTexture(styleKey: IconStudioStyleKey, palette: StylePalette) {
  if (styleKey === "outline_technical") {
    return `
      <g opacity="0.25" stroke="${palette.texture}" stroke-width="2">
        <line x1="164" y1="140" x2="860" y2="140" />
        <line x1="164" y1="882" x2="860" y2="882" />
        <line x1="164" y1="140" x2="164" y2="882" />
        <line x1="860" y1="140" x2="860" y2="882" />
        <line x1="240" y1="212" x2="784" y2="804" stroke-dasharray="12 10" />
      </g>
    `;
  }

  if (styleKey === "print_material_realistic") {
    return `
      <g opacity="0.3" stroke="${palette.texture}" stroke-width="1.5">
        <line x1="204" y1="238" x2="812" y2="238" />
        <line x1="204" y1="282" x2="812" y2="282" />
        <line x1="204" y1="326" x2="812" y2="326" />
        <line x1="204" y1="370" x2="812" y2="370" />
      </g>
    `;
  }

  return `<rect x="142" y="118" width="740" height="788" rx="40" fill="${palette.background}" />`;
}

function renderBrandOverlay(
  payload: IconStudioGenerationPayload,
  brandAssetDataUrl: string | null,
  brandAsset: IconStudioBrandAssetRow | null,
  palette: StylePalette,
) {
  if (!payload.brandOverlay.enabled || !payload.brandOverlay.placementPreset) {
    return "";
  }

  const anchor = ANCHOR_BOXES[payload.brandOverlay.placementPreset];
  const finish = payload.brandOverlay.finishKey;
  const finishLabel = getIconStudioBrandFinishLabel(finish);
  const baseOpacity = finish === "inherit_surface" ? 0.82 : 1;
  const borderOpacity = finish === "flat" ? 0 : 0.35;
  const shadow = finish === "gloss_surface"
    ? "filter=\"url(#glossShadow)\""
    : finish === "embossed_light"
      ? "filter=\"url(#embossShadow)\""
      : finish === "debossed_light"
        ? "filter=\"url(#debossShadow)\""
        : "";

  const gloss = finish === "gloss_surface"
    ? `<rect x="${anchor.x}" y="${anchor.y}" width="${anchor.width}" height="${anchor.height * 0.42}" rx="18" fill="rgba(255,255,255,0.28)" />`
    : "";

  if (brandAssetDataUrl) {
    return `
      <g ${shadow}>
        <rect
          x="${anchor.x}"
          y="${anchor.y}"
          width="${anchor.width}"
          height="${anchor.height}"
          rx="18"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(15,23,42,${borderOpacity})"
          stroke-width="3"
        />
        <image
          href="${brandAssetDataUrl}"
          x="${anchor.x + 14}"
          y="${anchor.y + 14}"
          width="${anchor.width - 28}"
          height="${anchor.height - 28}"
          preserveAspectRatio="xMidYMid meet"
          opacity="${baseOpacity}"
        />
        ${gloss}
      </g>
    `;
  }

  return `
    <g ${shadow}>
      <rect
        x="${anchor.x}"
        y="${anchor.y}"
        width="${anchor.width}"
        height="${anchor.height}"
        rx="18"
        fill="${palette.accent}"
        opacity="0.12"
        stroke="${palette.accentAlt}"
        stroke-width="3"
      />
      <text x="${anchor.x + anchor.width / 2}" y="${anchor.y + anchor.height / 2 - 6}" text-anchor="middle" font-size="24" font-weight="700" fill="${palette.text}">
        ${escapeXml(brandAsset?.name || "Brand")}
      </text>
      <text x="${anchor.x + anchor.width / 2}" y="${anchor.y + anchor.height / 2 + 24}" text-anchor="middle" font-size="14" fill="${palette.text}">
        ${escapeXml(finishLabel)}
      </text>
      ${gloss}
    </g>
  `;
}

function renderMockIconSvg(
  payload: IconStudioGenerationPayload,
  draftIndex: number,
  brandAssetDataUrl: string | null,
  brandAsset: IconStudioBrandAssetRow | null,
  referenceAssets: IconStudioReferenceAssetRow[],
) {
  const palette = STYLE_PALETTES[payload.styleKey];
  const productLabel = getIconStudioProductLabel(payload.productKey);
  const styleLabel = getIconStudioStyleLabel(payload.styleKey);
  const variantLabel = getIconStudioVariantLabel(payload.variantKey);
  const placementLabel = payload.brandOverlay.placementPreset
    ? getIconStudioPlacementPresets(payload.productKey, payload.variantKey)
        .find((placement) => placement.key === payload.brandOverlay.placementPreset)?.label || payload.brandOverlay.placementPreset
    : "Ingen";
  const seedAccent = draftIndex % 2 === 0 ? palette.accent : palette.accentAlt;

  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="surfaceGradient-${draftIndex}" x1="160" y1="112" x2="868" y2="900" gradientUnits="userSpaceOnUse">
          <stop stop-color="${palette.surface}" />
          <stop offset="0.56" stop-color="#ffffff" />
          <stop offset="1" stop-color="${palette.texture}" />
        </linearGradient>
        <linearGradient id="accentGradient-${draftIndex}" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${seedAccent}" />
          <stop offset="1" stop-color="${palette.accentAlt}" />
        </linearGradient>
        <filter id="shadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="${palette.shadow}" />
        </filter>
        <filter id="glossShadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="rgba(255,255,255,0.35)" />
        </filter>
        <filter id="embossShadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse">
          <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="rgba(255,255,255,0.45)" />
          <feDropShadow dx="-3" dy="-3" stdDeviation="5" flood-color="rgba(15,23,42,0.18)" />
        </filter>
        <filter id="debossShadow" x="0" y="0" width="1024" height="1024" filterUnits="userSpaceOnUse">
          <feDropShadow dx="3" dy="3" stdDeviation="4" flood-color="rgba(15,23,42,0.24)" />
          <feDropShadow dx="-2" dy="-2" stdDeviation="4" flood-color="rgba(255,255,255,0.3)" />
        </filter>
      </defs>
      <rect width="1024" height="1024" fill="transparent" />
      <rect x="92" y="92" width="840" height="840" rx="52" fill="${palette.background}" />
      ${renderTexture(payload.styleKey, palette)}
      <path d="M136 860 Q512 724 888 860" stroke="url(#accentGradient-${draftIndex})" stroke-width="26" stroke-linecap="round" opacity="0.2" />
      <g>
        ${renderProductGeometry(payload.productKey, payload.variantKey, payload.styleKey, draftIndex)}
      </g>
      ${renderBrandOverlay(payload, brandAssetDataUrl, brandAsset, palette)}
      <g transform="translate(140 826)">
        <rect width="744" height="124" rx="30" fill="rgba(255,255,255,0.8)" />
        <text x="36" y="48" font-size="34" font-weight="700" fill="${palette.text}">
          ${escapeXml(productLabel)}
        </text>
        <text x="36" y="86" font-size="18" fill="${palette.text}" opacity="0.76">
          ${escapeXml(styleLabel)} • ${escapeXml(variantLabel)} • ${referenceAssets.length} references • ${escapeXml(placementLabel)}
        </text>
      </g>
    </svg>
  `;
}

async function renderSvgToPngBlob(svgString: string, size: number) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Kunne ikke oprette canvas context til PNG rendering."));
        return;
      }

      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Kunne ikke skabe PNG output fra SVG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    };

    image.onerror = () => reject(new Error("SVG preview kunne ikke loades til PNG rendering."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  });
}

function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Billedet kunne ikke loades til Icon Studio compositing."));
    image.src = src;
  });
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Kunne ikke læse Icon Studio blob."));
    };
    reader.onerror = () => reject(new Error("Kunne ikke læse Icon Studio blob."));
    reader.readAsDataURL(blob);
  });
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetSize: number,
) {
  const scale = Math.max(targetSize / image.width, targetSize / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (targetSize - drawWidth) / 2;
  const y = (targetSize - drawHeight) / 2;
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

function getOverlayBox(
  placementPreset: IconStudioPlacementPresetKey | null,
  outputSize: number,
) {
  const baseBox = placementPreset ? ANCHOR_BOXES[placementPreset] : null;
  const fallback = ANCHOR_BOXES.front_center;
  const box = baseBox || fallback;
  const scale = outputSize / 1024;

  return {
    x: box.x * scale,
    y: box.y * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

function getContainSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

function applyFinishPreset(
  context: CanvasRenderingContext2D,
  finishKey: IconStudioBrandFinishKey,
) {
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowColor = "transparent";

  switch (finishKey) {
    case "embossed_light":
      context.globalAlpha = 0.96;
      context.shadowBlur = 18;
      context.shadowOffsetY = 6;
      context.shadowColor = "rgba(15, 23, 42, 0.18)";
      break;
    case "debossed_light":
      context.globalAlpha = 0.84;
      context.shadowBlur = 10;
      context.shadowOffsetY = -4;
      context.shadowColor = "rgba(15, 23, 42, 0.16)";
      break;
    case "gloss_surface":
      context.globalAlpha = 1;
      context.shadowBlur = 22;
      context.shadowOffsetY = 10;
      context.shadowColor = "rgba(255, 255, 255, 0.22)";
      break;
    case "inherit_surface":
      context.globalAlpha = 0.92;
      context.shadowBlur = 12;
      context.shadowOffsetY = 5;
      context.shadowColor = "rgba(15, 23, 42, 0.12)";
      break;
    default:
      break;
  }
}

export async function applyBrandOverlayToRasterBlob(params: {
  blob: Blob;
  payload: IconStudioGenerationPayload;
  brandAssetDataUrl: string | null;
}) {
  if (!params.payload.brandOverlay.enabled || !params.brandAssetDataUrl) {
    return params.blob;
  }

  const baseImageSrc = await blobToDataUrl(params.blob);
  const [baseImage, brandImage] = await Promise.all([
    loadBrowserImage(baseImageSrc),
    loadBrowserImage(params.brandAssetDataUrl),
  ]);

  const outputSize = params.payload.output.size;
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Kunne ikke oprette canvas context til Icon Studio compositing.");
  }

  context.clearRect(0, 0, outputSize, outputSize);
  drawImageCover(context, baseImage, outputSize);

  const overlayBox = getOverlayBox(params.payload.brandOverlay.placementPreset, outputSize);
  const contained = getContainSize(brandImage.width, brandImage.height, overlayBox.width, overlayBox.height);
  const drawX = overlayBox.x + (overlayBox.width - contained.width) / 2;
  const drawY = overlayBox.y + (overlayBox.height - contained.height) / 2;

  context.save();
  applyFinishPreset(context, params.payload.brandOverlay.finishKey);
  context.drawImage(brandImage, drawX, drawY, contained.width, contained.height);
  context.restore();

  if (params.payload.brandOverlay.finishKey === "gloss_surface") {
    const gloss = context.createLinearGradient(drawX, drawY, drawX, drawY + contained.height);
    gloss.addColorStop(0, "rgba(255,255,255,0.34)");
    gloss.addColorStop(0.45, "rgba(255,255,255,0.08)");
    gloss.addColorStop(1, "rgba(255,255,255,0)");
    context.save();
    context.globalCompositeOperation = "screen";
    context.fillStyle = gloss;
    context.fillRect(drawX, drawY, contained.width, contained.height);
    context.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Kunne ikke afslutte Icon Studio compositing."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function averageCornerBackgroundColor(imageData: ImageData) {
  const { data, width, height } = imageData;
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  let red = 0;
  let green = 0;
  let blue = 0;

  points.forEach(([x, y]) => {
    const index = (y * width + x) * 4;
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
  });

  return {
    red: Math.round(red / points.length),
    green: Math.round(green / points.length),
    blue: Math.round(blue / points.length),
  };
}

function colorDistance(
  red: number,
  green: number,
  blue: number,
  background: { red: number; green: number; blue: number },
) {
  const dr = red - background.red;
  const dg = green - background.green;
  const db = blue - background.blue;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export async function removeUniformBackgroundFromRasterBlob(params: {
  blob: Blob;
  outputSize: number;
}) {
  const imageSrc = await blobToDataUrl(params.blob);
  const image = await loadBrowserImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = params.outputSize;
  canvas.height = params.outputSize;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Kunne ikke oprette canvas context til background removal.");
  }

  context.clearRect(0, 0, params.outputSize, params.outputSize);
  drawImageCover(context, image, params.outputSize);

  const imageData = context.getImageData(0, 0, params.outputSize, params.outputSize);
  const background = averageCornerBackgroundColor(imageData);
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const hardThreshold = 32;
  const softThreshold = 72;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  push(0, 0);
  push(width - 1, 0);
  push(0, height - 1);
  push(width - 1, height - 1);

  while (queue.length) {
    const pixelIndex = queue.shift()!;
    const offset = pixelIndex * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    const distance = colorDistance(red, green, blue, background);

    if (alpha === 0 || distance > hardThreshold) {
      continue;
    }

    data[offset + 3] = 0;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    if (data[offset + 3] === 0) continue;

    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const brightness = (red + green + blue) / 3;
    const distance = colorDistance(red, green, blue, background);

    if (brightness < 170 || distance <= hardThreshold || distance >= softThreshold) {
      continue;
    }

    const ratio = (distance - hardThreshold) / (softThreshold - hardThreshold);
    data[offset + 3] = Math.max(0, Math.min(255, Math.round(255 * ratio)));
  }

  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Kunne ikke afslutte background removal."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

export const mockIconStudioProvider: IconStudioProvider = {
  key: "mock-icon-studio-v1",
  async generateDrafts(input) {
    const draftLabels = ["Udkast A", "Udkast B", "Udkast C"];

    return Promise.all(
      draftLabels.map(async (label, draftIndex) => {
        const svgString = renderMockIconSvg(
          input.payload,
          draftIndex,
          input.brandAssetDataUrl,
          input.brandAsset,
          input.referenceAssets,
        );

        if (input.payload.output.format === "svg") {
          return {
            label,
            extension: "svg" as const,
            contentType: "image/svg+xml",
            blob: new Blob([svgString], { type: "image/svg+xml" }),
            width: input.payload.output.size,
            height: input.payload.output.size,
            metadata: {
              draftIndex,
              finishKey: input.payload.brandOverlay.finishKey,
            },
          };
        }

        const pngBlob = await renderSvgToPngBlob(svgString, input.payload.output.size);
        return {
          label,
          extension: "png" as const,
          contentType: "image/png",
          blob: pngBlob,
          width: input.payload.output.size,
          height: input.payload.output.size,
          metadata: {
            draftIndex,
            finishKey: input.payload.brandOverlay.finishKey,
          },
        };
      }),
    );
  },
};
