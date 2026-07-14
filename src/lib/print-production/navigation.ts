export const PRINT_PRODUCTION_VIEWS = [
  "overview",
  "products",
  "distribution",
  "orders",
  "settings",
] as const;

export type PrintProductionView = (typeof PRINT_PRODUCTION_VIEWS)[number];

const PRINT_PRODUCTION_VIEW_SET = new Set<string>(PRINT_PRODUCTION_VIEWS);

export function getPrintProductionView(search: string): PrintProductionView {
  const view = new URLSearchParams(search).get("view");
  return view && PRINT_PRODUCTION_VIEW_SET.has(view)
    ? (view as PrintProductionView)
    : "overview";
}

export function withPrintProductionView(
  search: string,
  view: PrintProductionView,
): string {
  const currentParams = new URLSearchParams(search);
  const nextParams = new URLSearchParams();
  const forceDomain = currentParams.get("force_domain");

  if (forceDomain) nextParams.set("force_domain", forceDomain);
  nextParams.set("view", view);

  return `/admin/printproduktion?${nextParams.toString()}`;
}
