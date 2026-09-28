import assert from "node:assert/strict";
import test from "node:test";

import {
  applyControlledTemplateValues,
  extractControlledFieldCandidates,
} from "./templateService.ts";
import type { CompanyTemplateField } from "./types.ts";

const editorJson = {
  version: "5.3.0",
  objects: [
    { type: "i-text", __layerId: "name-layer", text: "Navn", left: 10, top: 20, fill: "#111111" },
    { type: "rect", __layerId: "brand-block", fill: "#0055aa", left: 0, top: 0 },
  ],
};

const field: CompanyTemplateField = {
  id: "field-1",
  tenant_id: "tenant-1",
  company_id: "company-1",
  binding_id: "binding-1",
  field_key: "navn",
  label: "Navn",
  field_type: "text",
  fabric_object_id: "name-layer",
  is_required: true,
  default_source: null,
  default_value: "",
  validation_rules: {},
  allowed_values: [],
  max_length: 30,
  allow_position: false,
  allow_size: false,
  allow_style: false,
  sort_order: 0,
  created_at: "2026-07-13T00:00:00Z",
  updated_at: "2026-07-13T00:00:00Z",
};

test("extracts only stable editable text layers", () => {
  const candidates = extractControlledFieldCandidates(editorJson);
  assert.deepEqual(candidates, [{
    fabricObjectId: "name-layer",
    objectType: "i-text",
    currentValue: "Navn",
    suggestedLabel: "Navn",
  }]);
});

test("controlled values change text while locking design geometry and style", () => {
  const result = applyControlledTemplateValues(editorJson, [field], { navn: "Anna Jensen" });
  const objects = result.objects as Array<Record<string, unknown>>;
  assert.equal(objects[0].text, "Anna Jensen");
  assert.equal(objects[0].fill, "#111111");
  assert.equal(objects[0].left, 10);
  assert.equal(objects[0].selectable, false);
  assert.equal(objects[1].fill, "#0055aa");
  assert.equal(objects[1].evented, false);
  assert.equal((editorJson.objects[0] as any).text, "Navn");
});

test("controlled fields enforce required values and maximum length", () => {
  assert.throws(() => applyControlledTemplateValues(editorJson, [field], { navn: "" }), /skal udfyldes/i);
  assert.throws(
    () => applyControlledTemplateValues(editorJson, [{ ...field, max_length: 3 }], { navn: "Anna" }),
    /højst indeholde 3 tegn/i,
  );
});

test("missing source layer blocks derivation instead of editing another object", () => {
  assert.throws(
    () => applyControlledTemplateValues(editorJson, [{ ...field, fabric_object_id: "missing" }], { navn: "Anna" }),
    /findes ikke længere/i,
  );
});
