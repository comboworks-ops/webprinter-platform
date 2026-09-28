/** Saved addresses may arrive after the customer has started typing. */
export function canHydrateDeliveryAddress(fields: Record<string, string>): boolean {
  return Object.values(fields).every(value => !value.trim());
}

export function deliveryAddressLines(line1: string, line2: string): string {
  return [line1.trim(), line2.trim()].filter(Boolean).join(', ');
}

export function checkoutCountryCode(country: string): string | null {
  const value = country.trim();
  if (/^(danmark|denmark|dk)$/i.test(value)) return 'DK';
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : null;
}
