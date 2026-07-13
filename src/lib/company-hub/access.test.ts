import assert from "node:assert/strict";
import test from "node:test";

import {
  canApproveCompanyOrder,
  canManageCompany,
  canPlaceCompanyOrder,
  normalizeCompanyRole,
} from "./access.ts";

test("legacy Company Hub roles map to V2 capabilities", () => {
  assert.equal(normalizeCompanyRole("company_user"), "company_buyer");
  assert.equal(normalizeCompanyRole("company_admin"), "company_admin");
});

test("unknown roles receive the least privileged viewer role", () => {
  assert.equal(normalizeCompanyRole("owner"), "company_viewer");
  assert.equal(normalizeCompanyRole(null), "company_viewer");
});

test("only owners and company admins manage workspace configuration", () => {
  assert.equal(canManageCompany("company_owner"), true);
  assert.equal(canManageCompany("company_admin"), true);
  assert.equal(canManageCompany("company_approver"), false);
  assert.equal(canManageCompany("company_buyer"), false);
});

test("approvers, admins, and owners can approve requests", () => {
  assert.equal(canApproveCompanyOrder("company_owner"), true);
  assert.equal(canApproveCompanyOrder("company_admin"), true);
  assert.equal(canApproveCompanyOrder("company_approver"), true);
  assert.equal(canApproveCompanyOrder("company_buyer"), false);
});

test("viewers cannot place orders while active ordering roles can", () => {
  assert.equal(canPlaceCompanyOrder("company_owner"), true);
  assert.equal(canPlaceCompanyOrder("company_admin"), true);
  assert.equal(canPlaceCompanyOrder("company_approver"), true);
  assert.equal(canPlaceCompanyOrder("company_buyer"), true);
  assert.equal(canPlaceCompanyOrder("company_viewer"), false);
});
