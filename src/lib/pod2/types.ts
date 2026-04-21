// POD v2 System Types

export interface PodSupplierConnection {
    id: string;
    provider_key: string;
    base_url: string;
    auth_header_mode: 'authorization_bearer' | 'x_api_key' | 'custom';
    auth_header_name?: string;
    auth_header_prefix?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PodApiPreset {
    id: string;
    name: string;
    method: string;
    path: string;
    query: Record<string, any>;
    body?: Record<string, any>;
    created_at: string;
}

export interface PodCatalogProduct {
    id: string;
    status: 'draft' | 'published';
    public_title: { da: string; en: string };
    public_description: { da: string; en: string };
    public_images: string[];
    supplier_product_ref?: string; // Only visible to master
    supplier_product_data?: Record<string, any>;
    created_at: string;
    updated_at: string;
    pod2_catalog_attributes?: PodCatalogAttribute[];
    pod2_catalog_price_matrix?: PodCatalogPriceMatrix[];
}

export interface PodCatalogAttribute {
    id: string;
    catalog_product_id: string;
    group_key: string;
    group_label: { da: string; en: string };
    sort_order: number;
    pod2_catalog_attribute_values?: PodCatalogAttributeValue[];
}

export interface PodCatalogAttributeValue {
    id: string;
    attribute_id: string;
    value_key: string;
    value_label: { da: string; en: string };
    supplier_value_ref?: Record<string, any>; // Only visible to master
    is_default: boolean;
    sort_order: number;
}

export interface PodCatalogPriceMatrix {
    id: string;
    catalog_product_id: string;
    variant_signature: string;
    quantities: number[];
    base_costs: number[];
    recommended_retail: number[];
    currency: string;
    needs_quote: boolean;
    updated_at: string;
}

export interface PodTenantImport {
    id: string;
    tenant_id: string;
    catalog_product_id: string;
    product_id: string;
    variant_mapping: Record<string, any>;
    created_at: string;
}

export interface PodTenantBilling {
    tenant_id: string;
    stripe_customer_id: string;
    default_payment_method_id?: string;
    is_ready: boolean;
    updated_at: string;
}

export type PodSenderMode = 'standard' | 'blind' | 'custom';

export interface PodFulfillmentJob {
    id: string;
    tenant_id: string;
    order_id: string;
    order_item_id: string;
    catalog_product_id: string;
    product_id?: string;
    product_name?: string;
    variant_signature: string;
    qty: number;
    tenant_cost: number;
    currency: string;
    status: 'awaiting_approval' | 'payment_pending' | 'paid' | 'submitted' | 'processing' | 'failed' | 'completed';
    stripe_payment_intent_id?: string;
    provider_job_ref?: string;
    error_message?: string;
    customer_email?: string;
    recipient_name?: string;
    recipient_company?: string;
    delivery_summary?: string;
    shipping_method?: string;
    sender_mode?: PodSenderMode;
    sender_name?: string;
    sender_contact_id?: string;
    sender_address_json?: {
        company_name?: string | null;
        contact_name?: string | null;
        email?: string | null;
        phone?: string | null;
        street?: string | null;
        house_number?: string | null;
        postcode?: string | null;
        city?: string | null;
        country?: string | null;
        vat_number?: string | null;
    } | null;
    sender_logo_url?: string | null;
    approved_by_tenant_at?: string;
    approved_by_tenant_user_id?: string;
    submitted_by_master_at?: string;
    submitted_by_master_user_id?: string;
    master_notes?: string;
    // Print.com submission linkage (populated by pod2-submit-to-printcom).
    printcom_cart_id?: string | null;
    printcom_cart_item_id?: string | null;
    printcom_printjob_id?: string | null;
    printcom_design_id?: string | null;
    printcom_order_id?: string | null;
    printcom_order_raw?: Record<string, unknown> | null;
    printcom_submission_step?: 'contact' | 'logo' | 'cart' | 'sender' | 'files' | 'finalize' | 'submit' | null;
    printcom_last_error?: string | null;
    printcom_last_attempt_at?: string | null;
    created_at: string;
    updated_at: string;
}

// API Explorer types
export interface PodExplorerRequest {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    query?: Record<string, any>;
    requestBody?: Record<string, any>;
    connectionId?: string;
    baseUrlOverride?: string;
}

export interface PodExplorerResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
}

// Default quantities for POD products
export const POD_DEFAULT_QUANTITIES = [10, 25, 50, 100, 250, 500, 1000];

// Status labels
export const POD_JOB_STATUS_LABELS: Record<PodFulfillmentJob['status'], string> = {
    awaiting_approval: 'Afventer godkendelse',
    payment_pending: 'Betaling afventer',
    paid: 'Betalt - afventer master',
    submitted: 'Sendt til leverandør',
    processing: 'I produktion',
    failed: 'Fejlet',
    completed: 'Afsluttet',
};

export const POD_JOB_STATUS_COLORS: Record<PodFulfillmentJob['status'], string> = {
    awaiting_approval: 'bg-yellow-100 text-yellow-800',
    payment_pending: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    submitted: 'bg-purple-100 text-purple-800',
    processing: 'bg-indigo-100 text-indigo-800',
    failed: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-800',
};
