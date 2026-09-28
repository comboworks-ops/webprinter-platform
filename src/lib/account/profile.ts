type CustomerProfile = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company?: string | null;
};

type CustomerIdentity = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Saved profile fields are authoritative, including intentionally cleared values. */
export function resolveCustomerContact(user: CustomerIdentity, profile?: CustomerProfile | null) {
  const metadata = user.user_metadata || {};
  const hasSavedName = profile && (profile.first_name !== undefined || profile.last_name !== undefined);
  return {
    customerEmail: text(user.email),
    customerName: hasSavedName
      ? [text(profile.first_name), text(profile.last_name)].filter(Boolean).join(' ')
      : text(metadata.full_name) || text(metadata.name),
    customerPhone: profile?.phone !== undefined ? text(profile.phone) : text(metadata.phone),
    customerCompany: profile?.company !== undefined ? text(profile.company) : text(metadata.company),
  };
}

/** Late profile reads must never replace contact details already entered in checkout. */
export function fillEmptyCustomerContact(current: string, saved: string): string {
  return current || saved;
}
