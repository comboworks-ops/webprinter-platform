import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveClosestExactCombination,
  type ExactCombinationCandidate,
} from "./exactCombinationResolver.ts";

const sectionOrder = ["model", "print", "spine", "paper", "finish"];

const candidate = (
  model: string,
  print: string,
  spine: string,
  paper: string,
  finish: string,
): ExactCombinationCandidate => ({
  selections: { model, print, spine, paper, finish },
});

test("switches paper to the closest exact row when the requested finish is documented there", () => {
  const result = resolveClosestExactCombination({
    candidates: [
      candidate("a4", "4+4", "5mm", "silk", "none"),
      candidate("a4", "4+4", "5mm", "chromocard", "soft-touch"),
      candidate("a4", "4+0", "5mm", "chromocard", "soft-touch"),
    ],
    currentSelections: {
      model: "a4",
      print: "4+4",
      spine: "5mm",
      paper: "silk",
      finish: "none",
    },
    requestedSectionId: "finish",
    requestedValueId: "soft-touch",
    sectionOrder,
    lockedSectionIds: ["model"],
  });

  assert.deepEqual(result?.selections, {
    model: "a4",
    print: "4+4",
    spine: "5mm",
    paper: "chromocard",
    finish: "soft-touch",
  });
});

test("never crosses the locked folder model even when another model has a closer row", () => {
  const result = resolveClosestExactCombination({
    candidates: [
      candidate("a5", "4+4", "5mm", "silk", "soft-touch"),
      candidate("a4", "4+0", "3mm", "chromocard", "soft-touch"),
    ],
    currentSelections: {
      model: "a4",
      print: "4+4",
      spine: "5mm",
      paper: "silk",
      finish: "none",
    },
    requestedSectionId: "finish",
    requestedValueId: "soft-touch",
    sectionOrder,
    lockedSectionIds: ["model"],
  });

  assert.equal(result?.selections.model, "a4");
});

test("allows the model to change when the model itself is requested", () => {
  const result = resolveClosestExactCombination({
    candidates: [
      candidate("a5", "4+4", "5mm", "silk", "none"),
    ],
    currentSelections: {
      model: "a4",
      print: "4+4",
      spine: "5mm",
      paper: "silk",
      finish: "none",
    },
    requestedSectionId: "model",
    requestedValueId: "a5",
    sectionOrder,
  });

  assert.equal(result?.selections.model, "a5");
});

test("uses customer section order to break equal-change ties", () => {
  const result = resolveClosestExactCombination({
    candidates: [
      candidate("a4", "4+0", "5mm", "silk", "soft-touch"),
      candidate("a4", "4+4", "3mm", "silk", "soft-touch"),
    ],
    currentSelections: {
      model: "a4",
      print: "4+4",
      spine: "5mm",
      paper: "silk",
      finish: "none",
    },
    requestedSectionId: "finish",
    requestedValueId: "soft-touch",
    sectionOrder,
    lockedSectionIds: ["model"],
  });

  assert.equal(result?.selections.print, "4+4");
  assert.equal(result?.selections.spine, "3mm");
});

test("returns null instead of inventing a missing requested combination", () => {
  const candidates = [candidate("a4", "4+4", "5mm", "silk", "none")];
  const currentSelections = candidates[0].selections;

  assert.equal(resolveClosestExactCombination({
    candidates,
    currentSelections,
    requestedSectionId: "finish",
    requestedValueId: "soft-touch",
    sectionOrder,
    lockedSectionIds: ["model"],
  }), null);

  assert.equal(currentSelections.finish, "none");
});
