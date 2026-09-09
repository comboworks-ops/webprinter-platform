const unavailablePrice = new Set([
  "checkout_quote_ambiguous", "checkout_quote_unavailable", "checkout_storformat_price_missing", "checkout_storformat_quantity_price_missing",
  "checkout_storformat_price_invalid", "checkout_storformat_layout_ambiguous", "checkout_quantity_unavailable",
]);
const invalidSelection = new Set([
  "checkout_dimensions_exceed_material", "checkout_dimensions_invalid", "checkout_area_mismatch",
  "checkout_storformat_required_selection_missing", "checkout_storformat_selection_invalid",
  "checkout_format_dimensions_unverified", "checkout_invalid_options", "checkout_amount_mismatch",
]);

/** Show known public error codes, never arbitrary provider/database error text. */
export async function checkoutStartMessage(error: unknown): Promise<string> {
  let code: unknown;
  try {
    if (error && typeof error === "object" && "context" in error && error.context instanceof Response) {
      const body = await error.context.clone().json();
      if (body?.contract_version === 2) code = body.error;
    }
  } catch { /* A lost or non-JSON response keeps the payment reference recoverable. */ }
  if (typeof code === "string" && unavailablePrice.has(code)) {
    return "Butikken mangler en entydig pris for dette valg. Kontakt butikken med produkt, mål og antal.";
  }
  if (typeof code === "string" && invalidSelection.has(code)) {
    return "Pris, mål eller tilvalg kunne ikke bekræftes. Annuller den påbegyndte betaling nedenfor, og vælg produktet igen.";
  }
  if (code === "checkout_backend_not_ready" || code === "checkout_payments_unavailable") {
    return "Butikkens onlinebetaling er ikke klar. Kontakt butikken for at bestille.";
  }
  return "Betalingen kunne ikke startes sikkert. Prøv igen med de samme oplysninger, eller kontakt butikken.";
}
