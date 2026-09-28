import assert from "node:assert/strict";
import test from "node:test";
import { calculateLandingExample, parseExampleDimension } from "./landingCalculatorExample.ts";

const example = { width: "100", height: "100", quantity: "1", material: "banner" };

test("the initial one-square-metre example costs 120 kr", () => {
  const result = calculateLandingExample(example);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value?.areaM2, 1);
  assert.equal(result.value?.totalPrice, 120);
});

test("dimension, material and quantity changes use the existing area calculation", () => {
  const result = calculateLandingExample({ width: "200", height: "50", quantity: "5", material: "sign" });
  assert.equal(result.value?.areaM2, 1);
  assert.equal(result.value?.totalAreaM2, 5);
  assert.equal(result.value?.totalPrice, 900);
});

test("Danish decimal commas and the existing whole-krone rounding are supported", () => {
  const result = calculateLandingExample({ ...example, width: "75,5", height: "50" });
  assert.equal(result.value?.widthCm, 75.5);
  assert.equal(result.value?.totalPrice, 45);
  assert.equal(parseExampleDimension(".5"), 0.5);
  assert.equal(parseExampleDimension("500"), 500);
});

test("empty, non-finite, non-decimal, zero and out-of-range dimensions never produce a price", () => {
  for (const width of ["", " ", "0", "-1", "NaN", "Infinity", "1e309", "0x10", "500.1", "12cm", "2,3,4"]) {
    const result = calculateLandingExample({ ...example, width });
    assert.equal(result.value, null, `Expected no price for ${JSON.stringify(width)}`);
    assert.ok(result.errors.width);
  }
  const result = calculateLandingExample({ ...example, height: "" });
  assert.equal(result.value, null);
  assert.ok(result.errors.height);
});

test("only demonstration quantities and materials are accepted", () => {
  for (const quantity of ["", "0", "2", "-5", "Infinity"]) {
    assert.equal(calculateLandingExample({ ...example, quantity }).value, null);
  }
  for (const material of ["", "unknown", "toString", "__proto__"]) {
    assert.equal(calculateLandingExample({ ...example, material }).value, null);
  }
});

test("the maximum supported dimensions and quantity remain finite", () => {
  const result = calculateLandingExample({ width: "500", height: "500", quantity: "10", material: "sign" });
  assert.equal(result.value?.totalAreaM2, 250);
  assert.equal(result.value?.totalPrice, 45000);
});
