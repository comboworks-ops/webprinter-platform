import { supabase } from "@/integrations/supabase/client";

export type CheckoutCustomerProfileSenderMode = "standard" | "blind" | "custom";

export interface CheckoutCustomerProfile {
  id: string;
  label: string;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerCompany?: string | null;
  deliveryRecipientName?: string | null;
  deliveryCompany?: string | null;
  deliveryAddress?: string | null;
  deliveryZip?: string | null;
  deliveryCity?: string | null;
  useSeparateBillingAddress?: boolean | null;
  billingName?: string | null;
  billingCompany?: string | null;
  billingAddress?: string | null;
  billingZip?: string | null;
  billingCity?: string | null;
  senderMode?: CheckoutCustomerProfileSenderMode | null;
  senderName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CheckoutCustomerProfileRow {
  id: string;
  user_id: string;
  label: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  delivery_recipient_name: string | null;
  delivery_company: string | null;
  delivery_address: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  use_separate_billing_address: boolean | null;
  billing_name: string | null;
  billing_company: string | null;
  billing_address: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  sender_mode: CheckoutCustomerProfileSenderMode | null;
  sender_name: string | null;
  created_at: string;
  updated_at: string;
}

const STORAGE_PREFIX = "wp_checkout_customer_profiles";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getStorageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}:${scopeId}`;
}

function readLegacyCheckoutCustomerProfiles(scopeId: string): CheckoutCustomerProfile[] {
  if (!isBrowser() || !scopeId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(scopeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string")
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  } catch {
    return [];
  }
}

function writeLegacyCheckoutCustomerProfiles(scopeId: string, profiles: CheckoutCustomerProfile[]): boolean {
  if (!isBrowser() || !scopeId) return false;
  try {
    localStorage.setItem(getStorageKey(scopeId), JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

function clearLegacyCheckoutCustomerProfiles(scopeId: string): void {
  if (!isBrowser() || !scopeId) return;
  localStorage.removeItem(getStorageKey(scopeId));
}

function mapRowToProfile(row: CheckoutCustomerProfileRow): CheckoutCustomerProfile {
  return {
    id: row.id,
    label: row.label,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerCompany: row.customer_company,
    deliveryRecipientName: row.delivery_recipient_name,
    deliveryCompany: row.delivery_company,
    deliveryAddress: row.delivery_address,
    deliveryZip: row.delivery_zip,
    deliveryCity: row.delivery_city,
    useSeparateBillingAddress: row.use_separate_billing_address,
    billingName: row.billing_name,
    billingCompany: row.billing_company,
    billingAddress: row.billing_address,
    billingZip: row.billing_zip,
    billingCity: row.billing_city,
    senderMode: row.sender_mode,
    senderName: row.sender_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileToRow(
  userId: string,
  input: Omit<CheckoutCustomerProfile, "createdAt" | "updatedAt">
): Omit<CheckoutCustomerProfileRow, "created_at" | "updated_at"> {
  return {
    id: input.id,
    user_id: userId,
    label: input.label,
    customer_email: input.customerEmail || null,
    customer_name: input.customerName || null,
    customer_phone: input.customerPhone || null,
    customer_company: input.customerCompany || null,
    delivery_recipient_name: input.deliveryRecipientName || null,
    delivery_company: input.deliveryCompany || null,
    delivery_address: input.deliveryAddress || null,
    delivery_zip: input.deliveryZip || null,
    delivery_city: input.deliveryCity || null,
    use_separate_billing_address: input.useSeparateBillingAddress ?? false,
    billing_name: input.billingName || null,
    billing_company: input.billingCompany || null,
    billing_address: input.billingAddress || null,
    billing_zip: input.billingZip || null,
    billing_city: input.billingCity || null,
    sender_mode: input.senderMode || "standard",
    sender_name: input.senderName || null,
  };
}

function isMissingProfilesTable(error: any): boolean {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("checkout_customer_profiles") && (
    error?.code === "42P01"
    || error?.code === "PGRST205"
    || message.includes("could not find the table")
    || message.includes("relation")
  );
}

async function migrateLegacyProfiles(scopeId: string): Promise<CheckoutCustomerProfile[] | null> {
  const legacyProfiles = readLegacyCheckoutCustomerProfiles(scopeId);
  if (legacyProfiles.length === 0) return [];
  const rows = legacyProfiles.map((profile) => mapProfileToRow(scopeId, profile));
  const { data, error } = await (supabase
    .from("checkout_customer_profiles" as any)
    .upsert(rows, { onConflict: "id" })
    .select("*")) as any;

  if (error) {
    if (isMissingProfilesTable(error)) {
      return null;
    }
    console.error("Customer profile migration error:", error);
    return null;
  }

  clearLegacyCheckoutCustomerProfiles(scopeId);
  return ((data as CheckoutCustomerProfileRow[] | null) || [])
    .map(mapRowToProfile)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export async function readCheckoutCustomerProfiles(scopeId: string): Promise<CheckoutCustomerProfile[]> {
  if (!scopeId) return [];

  const { data, error } = await (supabase
    .from("checkout_customer_profiles" as any)
    .select("*")
    .eq("user_id", scopeId)
    .order("updated_at", { ascending: false })) as any;

  if (error) {
    if (isMissingProfilesTable(error)) {
      return readLegacyCheckoutCustomerProfiles(scopeId);
    }
    console.error("Customer profile read error:", error);
    return readLegacyCheckoutCustomerProfiles(scopeId);
  }

  const remoteProfiles = ((data as CheckoutCustomerProfileRow[] | null) || []).map(mapRowToProfile);
  if (remoteProfiles.length > 0) {
    if (readLegacyCheckoutCustomerProfiles(scopeId).length > 0) {
      clearLegacyCheckoutCustomerProfiles(scopeId);
    }
    return remoteProfiles;
  }

  const migrated = await migrateLegacyProfiles(scopeId);
  return migrated ?? remoteProfiles;
}

export async function upsertCheckoutCustomerProfile(
  scopeId: string,
  input: Omit<CheckoutCustomerProfile, "id" | "createdAt" | "updatedAt"> & { id?: string | null }
): Promise<CheckoutCustomerProfile | null> {
  if (!scopeId) return null;
  const now = new Date().toISOString();
  const existing = await readCheckoutCustomerProfiles(scopeId);
  const nextProfile: CheckoutCustomerProfile = {
    ...input,
    id: input.id || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: input.id ? (existing.find((entry) => entry.id === input.id)?.createdAt || now) : now,
    updatedAt: now,
  };

  const { data, error } = await (supabase
    .from("checkout_customer_profiles" as any)
    .upsert(mapProfileToRow(scopeId, nextProfile), { onConflict: "id" })
    .select("*")
    .single()) as any;

  if (error) {
    if (isMissingProfilesTable(error)) {
      const nextProfiles = [
        nextProfile,
        ...existing.filter((entry) => entry.id !== nextProfile.id),
      ].slice(0, 50);
      return writeLegacyCheckoutCustomerProfiles(scopeId, nextProfiles) ? nextProfile : null;
    }
    console.error("Customer profile upsert error:", error);
    return null;
  }

  return mapRowToProfile(data as CheckoutCustomerProfileRow);
}

export async function deleteCheckoutCustomerProfile(scopeId: string, profileId: string): Promise<boolean> {
  if (!scopeId || !profileId) return false;

  const { error } = await (supabase
    .from("checkout_customer_profiles" as any)
    .delete()
    .eq("user_id", scopeId)
    .eq("id", profileId)) as any;

  if (error) {
    if (isMissingProfilesTable(error)) {
      const existing = readLegacyCheckoutCustomerProfiles(scopeId);
      return writeLegacyCheckoutCustomerProfiles(
        scopeId,
        existing.filter((entry) => entry.id !== profileId),
      );
    }
    console.error("Customer profile delete error:", error);
    return false;
  }

  return true;
}
