import type { CompanyRole, CompanyRoleValue } from "./types";

const COMPANY_ROLES = new Set<CompanyRole>([
  "company_owner",
  "company_admin",
  "company_approver",
  "company_buyer",
  "company_viewer",
]);

export function normalizeCompanyRole(role: string | null | undefined): CompanyRole {
  if (role === "company_user") return "company_buyer";
  if (role && COMPANY_ROLES.has(role as CompanyRole)) return role as CompanyRole;
  return "company_viewer";
}

export function canManageCompany(role: CompanyRoleValue | string | null | undefined): boolean {
  const normalized = normalizeCompanyRole(role);
  return normalized === "company_owner" || normalized === "company_admin";
}

export function canApproveCompanyOrder(role: CompanyRoleValue | string | null | undefined): boolean {
  const normalized = normalizeCompanyRole(role);
  return (
    normalized === "company_owner"
    || normalized === "company_admin"
    || normalized === "company_approver"
  );
}

export function canPlaceCompanyOrder(role: CompanyRoleValue | string | null | undefined): boolean {
  return normalizeCompanyRole(role) !== "company_viewer";
}
