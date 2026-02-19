export type StandardDeliveryMethod = {
  id: string;
  name: string;
  description: string;
  lead_time_days: number;
  production_days: number;
  shipping_days: number;
  delivery_window_days: number;
  auto_mark_delivered: boolean;
  auto_mark_days: number;
  price: number;
  cutoff_time: string;
  cutoff_label: "deadline" | "latest";
  cutoff_text: string;
};

const STANDARD_DELIVERY_METHODS: StandardDeliveryMethod[] = [
  {
    id: "standard",
    name: "Standard levering",
    description: "2-4 hverdage",
    lead_time_days: 4,
    production_days: 2,
    shipping_days: 2,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 49,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: "",
  },
  {
    id: "express",
    name: "Express levering",
    description: "1-2 hverdage",
    lead_time_days: 2,
    production_days: 1,
    shipping_days: 1,
    delivery_window_days: 0,
    auto_mark_delivered: false,
    auto_mark_days: 0,
    price: 199,
    cutoff_time: "12:00",
    cutoff_label: "deadline",
    cutoff_text: "",
  },
];

export function cloneStandardDeliveryMethods(): StandardDeliveryMethod[] {
  return STANDARD_DELIVERY_METHODS.map((method) => ({ ...method }));
}

function fallbackDeliveryMethodCost(methodId?: string | null): number {
  const normalizedId = String(methodId || "").trim().toLowerCase();
  if (normalizedId === "standard") return 49;
  if (normalizedId === "express" || normalizedId === "ekspres") return 199;
  return 0;
}

export function resolveDeliveryMethodCost(
  _baseTotal: number,
  method?: { id?: string | null; price?: number | null } | null,
): number {
  if (!method) return 0;
  const explicitPrice = Number(method.price);
  if (Number.isFinite(explicitPrice)) {
    return Math.max(0, Math.round(explicitPrice));
  }

  return fallbackDeliveryMethodCost(method.id);
}
