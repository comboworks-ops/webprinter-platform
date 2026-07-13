export type CompanyRole =
  | "company_owner"
  | "company_admin"
  | "company_approver"
  | "company_buyer"
  | "company_viewer";

export type LegacyCompanyRole = "company_user";
export type CompanyRoleValue = CompanyRole | LegacyCompanyRole;

export type CompanyAccountStatus = "draft" | "active" | "paused" | "archived";
export type CompanyMemberStatus = "active" | "disabled";
export type CompanyOfficeStatus = "active" | "disabled" | "archived";
export type CompanyCatalogStatus = "draft" | "active" | "archived";
export type CompanyTemplateStatus = "draft" | "active" | "retired";
export type CompanyAddressType = "delivery" | "billing" | "both";
export type CompanyOfficeScope = "all" | "selected";

export type CompanyJson = Record<string, unknown>;

export interface CompanyAccount {
  id: string;
  tenant_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  slug?: string | null;
  status?: CompanyAccountStatus;
  industry_key?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  billing_email?: string | null;
  settings?: CompanyJson;
  updated_at?: string;
}

export interface CompanyMember {
  company_id: string;
  tenant_id: string;
  user_id: string;
  role: CompanyRoleValue;
  created_at: string;
  status?: CompanyMemberStatus;
  is_all_offices?: boolean;
  updated_at?: string;
  user_email?: string;
  user_name?: string;
}

export interface CompanyMembership extends CompanyAccount {
  membership_role: CompanyRole;
  membership_status: CompanyMemberStatus;
  is_all_offices: boolean;
}

export interface CompanyOffice {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  is_default: boolean;
  status: CompanyOfficeStatus;
  profile_data: CompanyJson;
  created_at: string;
  updated_at: string;
}

export interface CompanyAddress {
  id: string;
  tenant_id: string;
  company_id: string;
  office_id: string | null;
  type: CompanyAddressType;
  label: string;
  recipient_name: string;
  company_name: string | null;
  street_address: string;
  street_address_2: string | null;
  postal_code: string;
  city: string;
  country_code: string;
  phone: string | null;
  is_default: boolean;
  status: CompanyOfficeStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanyCatalogCategory {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  image_url: string | null;
  sort_order: number;
  status: CompanyCatalogStatus;
  created_at: string;
  updated_at: string;
}

export interface HubItem {
  id: string;
  tenant_id: string;
  company_id: string;
  title: string;
  product_id: string | null;
  variant_id: string | null;
  default_quantity: number;
  default_options: CompanyJson;
  design_id: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string;
  status?: CompanyCatalogStatus;
  short_description?: string | null;
  category_id?: string | null;
  template_binding_id?: string | null;
  requires_approval?: boolean;
  is_featured?: boolean;
  office_scope?: CompanyOfficeScope;
  updated_at?: string;
  product_name?: string;
  product_slug?: string;
  product_pricing_type?: string;
}

export interface CompanyTemplateBinding {
  id: string;
  tenant_id: string;
  company_id: string;
  item_id: string;
  design_id: string | null;
  template_id: string | null;
  version: number;
  status: CompanyTemplateStatus;
  name: string;
  preview_url: string | null;
  output_mode: "vector_pdf" | "designer_pdf" | "upload_only";
  source_fingerprint: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyTemplateField {
  id: string;
  tenant_id: string;
  company_id: string;
  binding_id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "email" | "phone" | "url" | "image" | "select";
  fabric_object_id: string;
  is_required: boolean;
  default_source: string | null;
  default_value: unknown;
  validation_rules: CompanyJson;
  allowed_values: unknown[];
  max_length: number | null;
  allow_position: boolean;
  allow_size: boolean;
  allow_style: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyAsset {
  id: string;
  tenant_id: string;
  company_id: string;
  office_id: string | null;
  asset_type: "logo" | "image" | "source_pdf" | "approved_artwork" | "supporting_document";
  name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  metadata: CompanyJson;
  status: "processing" | "active" | "rejected" | "archived";
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyOrderRequestStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "checkout_started"
  | "ordered"
  | "cancelled"
  | "expired";

export interface CompanyOrderRequest {
  id: string;
  tenant_id: string;
  company_id: string;
  office_id: string | null;
  item_id: string;
  product_id: string;
  template_binding_id: string | null;
  template_version: number | null;
  requested_by: string;
  quantity: number;
  field_values: CompanyJson;
  product_configuration: CompanyJson;
  quote_snapshot: CompanyJson | null;
  quoted_total: number | null;
  address_snapshot: CompanyJson | null;
  status: CompanyOrderRequestStatus;
  approval_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyConsultantRequest {
  id: string;
  tenant_id: string;
  company_id: string;
  office_id: string | null;
  item_id: string | null;
  asset_id: string | null;
  request_type: "portal_setup" | "new_product" | "template_setup" | "file_help" | "general_advice";
  subject: string;
  message: string;
  status: "new" | "in_progress" | "waiting_for_customer" | "resolved" | "closed";
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
