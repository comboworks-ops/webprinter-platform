import { z } from "zod";

export const ERP_SHADOW_SCHEMA_VERSION = "1.0" as const;
export const ERP_SHADOW_EVENT_TYPE =
  "webprinter.production_order.shadow_requested" as const;

const boundedReference = z.string().trim().min(1).max(200);
const money = z.number().finite().nonnegative();

const selectedOptionsSchema = z
  .record(z.string().trim().max(500))
  .default({});

export const erpShadowMaterialRequirementSchema = z
  .object({
    materialRef: boundedReference,
    quantity: z.number().finite().positive(),
    unit: z.enum([
      "sheet",
      "meter",
      "square_meter",
      "kilogram",
      "liter",
      "piece",
      "roll",
    ]),
  })
  .strict();

export const erpShadowLineInputSchema = z
  .object({
    sourceOrderItemId: boundedReference,
    sourceProductId: boundedReference,
    title: z.string().trim().min(1).max(500),
    quantity: z.number().int().positive(),
    unitSellingPrice: money,
    selectedOptions: selectedOptionsSchema,
    productionRecipeRef: boundedReference.optional(),
    machineProfileRef: boundedReference.optional(),
    estimatedRunMinutes: z.number().finite().nonnegative().optional(),
    materialRequirements: z
      .array(erpShadowMaterialRequirementSchema)
      .max(100)
      .default([]),
  })
  .strict();

export const erpShadowProductionOrderInputSchema = z
  .object({
    tenantId: boundedReference,
    orderId: boundedReference,
    revision: z.number().int().nonnegative(),
    occurredAt: z.string().datetime({ offset: true }),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
    totalSellingPrice: money,
    customerRef: boundedReference.optional(),
    fulfillmentMode: z.enum(["internal", "outsourced", "undecided"]),
    lines: z.array(erpShadowLineInputSchema).min(1).max(250),
  })
  .strict();

export const erpShadowEventSchema = z
  .object({
    schemaVersion: z.literal(ERP_SHADOW_SCHEMA_VERSION),
    eventType: z.literal(ERP_SHADOW_EVENT_TYPE),
    sourceSystem: z.literal("webprinter"),
    effect: z.literal("shadow_only"),
    eventId: boundedReference,
    idempotencyKey: boundedReference,
    occurredAt: z.string().datetime({ offset: true }),
    source: z
      .object({
        tenantId: boundedReference,
        orderId: boundedReference,
        revision: z.number().int().nonnegative(),
      })
      .strict(),
    payload: z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/),
        totalSellingPrice: money,
        customerRef: boundedReference.optional(),
        lines: z.array(erpShadowLineInputSchema).min(1).max(250),
        production: z
          .object({
            fulfillmentMode: z.enum(["internal", "outsourced", "undecided"]),
            inventoryPosting: z.literal("disabled"),
          })
          .strict(),
        accounting: z
          .object({
            posting: z.literal("disabled"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type ErpShadowProductionOrderInput = z.input<
  typeof erpShadowProductionOrderInputSchema
>;
export type ErpShadowEvent = z.output<typeof erpShadowEventSchema>;

function sortRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

/**
 * Builds the only ERP event Webprinter is allowed to emit during the pilot.
 *
 * The strict input schema intentionally rejects personal contact details,
 * payment data, supplier credentials, and any request for a live side effect.
 */
export function buildErpShadowEvent(
  input: ErpShadowProductionOrderInput,
): ErpShadowEvent {
  const parsed = erpShadowProductionOrderInputSchema.parse(input);
  const idempotencyKey = [
    "webprinter",
    parsed.tenantId,
    "production-order",
    parsed.orderId,
    `revision-${parsed.revision}`,
  ].join(":");

  return erpShadowEventSchema.parse({
    schemaVersion: ERP_SHADOW_SCHEMA_VERSION,
    eventType: ERP_SHADOW_EVENT_TYPE,
    sourceSystem: "webprinter",
    effect: "shadow_only",
    eventId: idempotencyKey,
    idempotencyKey,
    occurredAt: parsed.occurredAt,
    source: {
      tenantId: parsed.tenantId,
      orderId: parsed.orderId,
      revision: parsed.revision,
    },
    payload: {
      currency: parsed.currency,
      totalSellingPrice: parsed.totalSellingPrice,
      customerRef: parsed.customerRef,
      lines: parsed.lines.map((line) => ({
        ...line,
        selectedOptions: sortRecord(line.selectedOptions),
      })),
      production: {
        fulfillmentMode: parsed.fulfillmentMode,
        inventoryPosting: "disabled",
      },
      accounting: {
        posting: "disabled",
      },
    },
  });
}

export function parseErpShadowEvent(input: unknown): ErpShadowEvent {
  return erpShadowEventSchema.parse(input);
}
