export interface CompanyAccount {
    id: string;
    tenant_id: string;
    name: string;
    logo_url: string | null;
    created_at: string;
}

export interface CompanyMember {
    company_id: string;
    tenant_id: string;
    user_id: string;
    role: 'company_admin' | 'company_user';
    created_at: string;
    // Join fields
    user_email?: string;
    user_name?: string;
}

export interface HubItem {
    id: string;
    tenant_id: string;
    company_id: string;
    title: string;
    product_id: string | null;
    variant_id: string | null;
    default_quantity: number;
    default_options: Record<string, any>;
    design_id: string | null;
    thumbnail_url: string | null;
    sort_order: number;
    created_at: string;
    // Join fields
    product_name?: string;
    product_slug?: string;
}
