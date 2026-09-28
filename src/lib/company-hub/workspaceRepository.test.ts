import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompanyAddressInsert,
  buildCompanyOfficeInsert,
} from "./workspaceRepository.ts";

const scope = { tenantId: "tenant-1", companyId: "company-1" };

test("office payload always receives tenant and company scope from the caller", () => {
  const input = {
    name: "  Aarhus C  ",
    code: "  AAR  ",
    email: " ",
    tenant_id: "attacker-tenant",
    company_id: "attacker-company",
  } as unknown as Parameters<typeof buildCompanyOfficeInsert>[1];

  const payload = buildCompanyOfficeInsert(scope, input);
  assert.equal(payload.tenant_id, "tenant-1");
  assert.equal(payload.company_id, "company-1");
  assert.equal(payload.name, "Aarhus C");
  assert.equal(payload.code, "AAR");
  assert.equal(payload.email, null);
  assert.equal("attacker-tenant" in payload, false);
});

test("office payload requires company scope and a visible name", () => {
  assert.throws(
    () => buildCompanyOfficeInsert({ tenantId: "", companyId: "company-1" }, { name: "Kontor" }),
    /tenant/i,
  );
  assert.throws(
    () => buildCompanyOfficeInsert(scope, { name: "   " }),
    /navn/i,
  );
});

test("address payload keeps Danish address fields and caller scope", () => {
  const payload = buildCompanyAddressInsert(scope, {
    officeId: "office-1",
    type: "delivery",
    label: "  Hovedkontor  ",
    recipientName: "  Varemodtagelsen  ",
    companyName: "  Boliggruppen A/S  ",
    streetAddress: "  Havnegade 12  ",
    postalCode: "  8000  ",
    city: "  Aarhus C  ",
    countryCode: "dk",
  });

  assert.equal(payload.tenant_id, "tenant-1");
  assert.equal(payload.company_id, "company-1");
  assert.equal(payload.office_id, "office-1");
  assert.equal(payload.label, "Hovedkontor");
  assert.equal(payload.recipient_name, "Varemodtagelsen");
  assert.equal(payload.street_address, "Havnegade 12");
  assert.equal(payload.postal_code, "8000");
  assert.equal(payload.city, "Aarhus C");
  assert.equal(payload.country_code, "DK");
});

test("address payload rejects incomplete delivery details", () => {
  assert.throws(
    () => buildCompanyAddressInsert(scope, {
      type: "delivery",
      label: "Kontor",
      recipientName: "Modtagelse",
      streetAddress: "",
      postalCode: "8000",
      city: "Aarhus",
    }),
    /adresse/i,
  );
});
