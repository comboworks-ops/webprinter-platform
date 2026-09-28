import assert from "node:assert/strict";
import test from "node:test";

import { findEmbeddedAdaptiveSelectorSectionId } from "./focusedAdaptiveSelector.ts";

test("selects a downstream adaptive section when every available value is a format", () => {
  assert.equal(findEmbeddedAdaptiveSelectorSectionId({
    focusSectionId: "model",
    sections: [
      { id: "model", adaptive: false, availablePresentationKinds: [] },
      { id: "variant", adaptive: true, availablePresentationKinds: ["format", "format"] },
    ],
  }), "variant");
});

test("selects a downstream adaptive section when every available value is a filling", () => {
  assert.equal(findEmbeddedAdaptiveSelectorSectionId({
    focusSectionId: "model",
    sections: [
      { id: "model", adaptive: false, availablePresentationKinds: [] },
      { id: "filling", adaptive: true, availablePresentationKinds: ["filling", "filling"] },
    ],
  }), "filling");
});

test("does not embed a mixed adaptive section", () => {
  assert.equal(findEmbeddedAdaptiveSelectorSectionId({
    focusSectionId: "model",
    sections: [
      { id: "model", adaptive: false, availablePresentationKinds: [] },
      { id: "mixed", adaptive: true, availablePresentationKinds: ["format", "filling"] },
    ],
  }), null);
});

test("requires explicit format metadata for every available value", () => {
  assert.equal(findEmbeddedAdaptiveSelectorSectionId({
    focusSectionId: "model",
    sections: [
      { id: "model", adaptive: false, availablePresentationKinds: [] },
      { id: "variant", adaptive: true, availablePresentationKinds: ["format", undefined] },
    ],
  }), null);
});

test("ignores matching adaptive sections that are upstream of the focused section", () => {
  assert.equal(findEmbeddedAdaptiveSelectorSectionId({
    focusSectionId: "model",
    sections: [
      { id: "upstream", adaptive: true, availablePresentationKinds: ["format"] },
      { id: "model", adaptive: false, availablePresentationKinds: [] },
    ],
  }), null);
});
