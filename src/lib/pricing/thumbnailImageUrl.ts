export type ThumbnailResizeMode = "cover" | "contain" | "fill";

type HiResThumbnailOptions = {
  mode?: ThumbnailResizeMode;
  quality?: number;
  dpr?: number;
  maxDpr?: number;
  minDimensionPx?: number;
};

const OBJECT_PUBLIC_MARKER = "/storage/v1/object/public/";
const RENDER_PUBLIC_MARKER = "/storage/v1/render/image/public/";

function safeNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getHiResThumbnailUrl(
  src: string | null | undefined,
  cssWidth: number,
  cssHeight: number,
  options: HiResThumbnailOptions = {}
): string | undefined {
  if (!src) return undefined;

  const mode = options.mode || "cover";
  const quality = Math.max(1, Math.min(100, Math.round(safeNumber(options.quality ?? 100, 100))));
  const maxDpr = Math.max(1, safeNumber(options.maxDpr ?? 3, 3));
  const dprRaw =
    options.dpr ??
    (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1);
  const dpr = Math.max(1, Math.min(maxDpr, safeNumber(dprRaw, 1)));
  const minDimensionPx = Math.max(1, Math.round(safeNumber(options.minDimensionPx ?? 1, 1)));

  const targetWidth = Math.max(minDimensionPx, Math.round(safeNumber(cssWidth, 1) * dpr));
  const targetHeight = Math.max(minDimensionPx, Math.round(safeNumber(cssHeight, 1) * dpr));

  try {
    const base = new URL(
      src,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );

    let objectPath = "";
    if (base.pathname.includes(RENDER_PUBLIC_MARKER)) {
      objectPath = base.pathname.split(RENDER_PUBLIC_MARKER)[1] || "";
    } else if (base.pathname.includes(OBJECT_PUBLIC_MARKER)) {
      objectPath = base.pathname.split(OBJECT_PUBLIC_MARKER)[1] || "";
    } else {
      return src;
    }

    if (!objectPath) return src;

    const rendered = new URL(`${base.origin}${RENDER_PUBLIC_MARKER}${objectPath}`);
    rendered.searchParams.set("width", String(targetWidth));
    rendered.searchParams.set("height", String(targetHeight));
    rendered.searchParams.set("resize", mode);
    rendered.searchParams.set("quality", String(quality));

    const token = base.searchParams.get("token");
    if (token) rendered.searchParams.set("token", token);

    return rendered.toString();
  } catch {
    return src;
  }
}
