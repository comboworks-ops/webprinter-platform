import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTenantSettingsUpdate,
  canVerifyDanishBusinessIdentity,
  createDanishBusinessIdentityDraft,
  isCurrentTenantOperation,
  mergeDanishBusinessIdentitySettings,
  normalizeBusinessEvidenceState,
  normalizeDanishCvr,
  normalizeStructuredDanishAddress,
  parseLegacyDanishAddress,
  readEditableCompanyName,
  readSavedStructuredViesIdentifier,
} from "./danishBusinessIdentity.ts";

test("tenant settings updates clear the required top-level name with an empty string", () => {
  const settings = { company: { name: null } };
  assert.deepEqual(buildTenantSettingsUpdate(settings, "   "), {
    settings,
    name: "",
  });
  assert.deepEqual(buildTenantSettingsUpdate(settings, "  Print House  "), {
    settings,
    name: "Print House",
  });
});

test("editable company name only falls back when settings have no saved name", () => {
  assert.equal(
    readEditableCompanyName({}, "Tenant fallback"),
    "Tenant fallback",
  );
  assert.equal(
    readEditableCompanyName({ name: null }, "Stale tenant name"),
    "",
  );
  assert.equal(
    readEditableCompanyName({ name: "Saved name" }, "Other"),
    "Saved name",
  );
});

test("CVR removes common separators and produces the exact VIES identifier", () => {
  assert.deepEqual(normalizeDanishCvr("12 34-56 78"), {
    input: "12 34-56 78",
    normalizedCvr: "12345678",
    viesCountryCode: "DK",
    viesVatNumber: "12345678",
    viesVatId: "DK12345678",
    canVerify: true,
  });
});

test("invalid CVR remains editable but cannot start verification", () => {
  const result = normalizeDanishCvr("12A 34");
  assert.equal(result.input, "12A 34");
  assert.equal(result.normalizedCvr, null);
  assert.equal(result.viesVatId, null);
  assert.equal(result.canVerify, false);

  const draft = createDanishBusinessIdentityDraft({ cvr: "12A 34" });
  assert.equal(draft.cvrInput, "12A 34");
  assert.equal(canVerifyDanishBusinessIdentity(draft), false);
});

test("Danish addresses use bounded structured fields and country DK", () => {
  assert.deepEqual(
    normalizeStructuredDanishAddress({
      streetName: "  Virksomhedsvej  ",
      houseNumber: "12B",
      floor: "2.",
      door: "th",
      postcode: "2100",
      city: " København Ø ",
      country: "DK",
    }),
    {
      valid: true,
      value: {
        streetName: "Virksomhedsvej",
        houseNumber: "12B",
        floor: "2.",
        door: "th",
        postcode: "2100",
        city: "København Ø",
        country: "DK",
      },
    },
  );

  assert.equal(
    normalizeStructuredDanishAddress({
      streetName: "Virksomhedsvej",
      houseNumber: "12B",
      floor: "",
      door: "",
      postcode: "21",
      city: "København",
      country: "DK",
    }).valid,
    false,
  );
  assert.equal(
    normalizeStructuredDanishAddress({
      streetName: "Virksomhedsvej",
      houseNumber: "12B",
      floor: "",
      door: "",
      postcode: "2100",
      city: "København",
      country: "SE",
    }).valid,
    false,
  );
});

test("legacy free text parses only when one Danish address is unambiguous", () => {
  assert.deepEqual(
    parseLegacyDanishAddress("Virksomhedsvej 12B, 2. th\n2100 København Ø"),
    {
      streetName: "Virksomhedsvej",
      houseNumber: "12B",
      floor: "2.",
      door: "th",
      postcode: "2100",
      city: "København Ø",
      country: "DK",
    },
  );
  assert.equal(
    parseLegacyDanishAddress("Postboks 10 eller Virksomhedsvej 12"),
    null,
  );
  assert.equal(parseLegacyDanishAddress("Virksomhedsvej 12\nKøbenhavn"), null);

  const ambiguous = createDanishBusinessIdentityDraft({
    address: "Postboks 10 eller Virksomhedsvej 12",
  });
  assert.equal(ambiguous.legacyAddressWasParsed, false);
  assert.equal(ambiguous.address.streetName, "");

  const futureVersion = createDanishBusinessIdentityDraft({
    address: "Virksomhedsvej 12\n2100 København Ø",
    business_identity_v1: {
      schemaVersion: 2,
      cvrInput: "87654321",
      address: {
        streetName: "Should not",
        houseNumber: "99",
        postcode: "9999",
        city: "Win",
        country: "DK",
      },
    },
  });
  assert.equal(futureVersion.cvrInput, "");
  assert.equal(futureVersion.address.streetName, "Virksomhedsvej");
  assert.equal(futureVersion.legacyAddressWasParsed, true);
});

test("settings merge is additive and preserves unrelated company and tenant settings", () => {
  const current = {
    checkout: { enabled: true },
    tax: { vatMode: "manual" },
    access: { signupComplete: true },
    company: {
      name: "Old name",
      cvr: "old raw",
      address: "old free text",
      logoReference: "keep-me",
    },
  };
  const draft = createDanishBusinessIdentityDraft({
    cvr: "12 34 56 78",
    address: "Virksomhedsvej 12\n2100 København Ø",
  });
  const merged = mergeDanishBusinessIdentitySettings(current, {
    companyPatch: {
      name: "New name",
      cvr: "12 34 56 78",
      address: "Virksomhedsvej 12\n2100 København Ø",
    },
    identity: draft,
  });

  assert.deepEqual(merged.checkout, current.checkout);
  assert.deepEqual(merged.tax, current.tax);
  assert.deepEqual(merged.access, current.access);
  assert.equal(merged.company.logoReference, "keep-me");
  assert.equal(merged.company.cvr, "12 34 56 78");
  assert.equal(merged.company.address, "Virksomhedsvej 12\n2100 København Ø");
  assert.deepEqual(merged.company.business_identity_v1, {
    schemaVersion: 1,
    cvrInput: "12 34 56 78",
    normalizedCvr: "12345678",
    viesVatId: "DK12345678",
    address: {
      streetName: "Virksomhedsvej",
      houseNumber: "12",
      floor: "",
      door: "",
      postcode: "2100",
      city: "København Ø",
      country: "DK",
    },
  });
});

test("all evidence states remain display-only and unknown input fails to unknown", () => {
  for (
    const state of [
      "unknown",
      "pending",
      "valid",
      "invalid",
      "unavailable",
      "stale",
    ] as const
  ) {
    const display = normalizeBusinessEvidenceState(state);
    assert.equal(display.status, state);
    assert.equal(display.effect, "display_only");
    assert.equal(display.blocksSave, false);
    assert.equal(display.changesVat, false);
    assert.equal(display.changesCheckout, false);
    assert.equal(display.changesTenantAccess, false);
  }
  assert.equal(
    normalizeBusinessEvidenceState("provider-secret").status,
    "unknown",
  );
});

test("only the exact persisted structured CVR is treated as saved evidence identity", () => {
  assert.equal(
    readSavedStructuredViesIdentifier({
      cvr: "87654321",
      business_identity_v1: {
        schemaVersion: 1,
        cvrInput: "12 34 56 78",
        normalizedCvr: "12345678",
        viesVatId: "DK12345678",
      },
    }),
    "DK12345678",
  );
  assert.equal(readSavedStructuredViesIdentifier({ cvr: "12345678" }), null);
  assert.equal(
    readSavedStructuredViesIdentifier({
      business_identity_v1: {
        schemaVersion: 1,
        normalizedCvr: "12345678",
        viesVatId: "DK87654321",
      },
    }),
    null,
  );
});

test("tenant operation results require the captured tenant and generation", () => {
  const captured = {
    tenantId: "10000000-0000-4000-8000-000000000001",
    generation: 4,
  } as const;
  assert.equal(isCurrentTenantOperation(captured, captured), true);
  assert.equal(
    isCurrentTenantOperation(captured, { ...captured, generation: 5 }),
    false,
  );
  assert.equal(
    isCurrentTenantOperation(captured, {
      tenantId: "20000000-0000-4000-8000-000000000002",
      generation: 4,
    }),
    false,
  );
});
