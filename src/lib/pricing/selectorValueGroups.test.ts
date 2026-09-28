import assert from "node:assert/strict";
import test from "node:test";

import {
  UNASSIGNED_SELECTOR_VALUE_GROUP_ID,
  resolveSelectorValueGroups,
} from "./selectorValueGroups.ts";

const values = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
  { id: "c", name: "C" },
  { id: "d", name: "D" },
];

test("keeps section order, deduplicates claims, ignores foreign IDs, and omits empty groups", () => {
  const groups = resolveSelectorValueGroups(values, [
    { id: "first", label: "First", valueIds: ["c", "foreign", "a", "c"] },
    { id: "empty", label: "Empty", valueIds: ["foreign"] },
    { id: "second", label: "Second", valueIds: ["c", "d"] },
  ]);

  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      label: group.label,
      valueIds: group.values.map((value) => value.id),
      isFallback: group.isFallback,
    })),
    [
      { id: "first", label: "First", valueIds: ["a", "c"], isFallback: false },
      { id: "second", label: "Second", valueIds: ["d"], isFallback: false },
      {
        id: UNASSIGNED_SELECTOR_VALUE_GROUP_ID,
        label: "Andre muligheder",
        valueIds: ["b"],
        isFallback: true,
      },
    ],
  );
});

test("keeps every visible value in the fallback when no configured group resolves", () => {
  const groups = resolveSelectorValueGroups(values, [
    { id: "foreign", label: "Foreign", valueIds: ["not-visible"] },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].isFallback, true);
  assert.deepEqual(groups[0].values.map((value) => value.id), ["a", "b", "c", "d"]);
});

test("does not introduce presentation groups when none are configured", () => {
  assert.deepEqual(resolveSelectorValueGroups(values, undefined), []);
  assert.deepEqual(resolveSelectorValueGroups(values, []), []);
});

test("renders duplicate visible UUIDs only once", () => {
  const groups = resolveSelectorValueGroups(
    [values[0], values[0], values[1]],
    [{ id: "first", label: "First", valueIds: ["a"] }],
  );

  assert.deepEqual(
    groups.flatMap((group) => group.values.map((value) => value.id)),
    ["a", "b"],
  );
});
