import assert from "node:assert/strict";
import test from "node:test";

import {
  clearPerValueThumbnailSizeOverrides,
  normalizeThumbnailCustomPx,
} from "./thumbnailSizes.ts";

test("clamps imported thumbnail sizes to the range supported by the editor", () => {
  assert.equal(normalizeThumbnailCustomPx(176), 160);
});

test("lets a section-level size take ownership from imported per-picture overrides", () => {
  const original: Record<string, { displayName: string; customImage?: string; imageSizePx?: number }> = {
    lindt: {
      displayName: "Lindt Lindor",
      customImage: "/lindt.png",
      imageSizePx: 176,
    },
    milka: {
      displayName: "Milka",
      customImage: "/milka.png",
      imageSizePx: 96,
    },
    noImage: {
      displayName: "Uden billede",
    },
  };

  const normalized = clearPerValueThumbnailSizeOverrides(original);

  assert.deepEqual(normalized, {
    lindt: {
      displayName: "Lindt Lindor",
      customImage: "/lindt.png",
    },
    milka: {
      displayName: "Milka",
      customImage: "/milka.png",
    },
    noImage: {
      displayName: "Uden billede",
    },
  });
  assert.notEqual(normalized, original);
  assert.equal(normalized.noImage, original.noImage);
});

test("keeps the existing value-settings object when there is no override to clear", () => {
  const original: Record<string, { displayName: string; customImage?: string; imageSizePx?: number }> = {
    lindt: {
      displayName: "Lindt Lindor",
      customImage: "/lindt.png",
    },
  };

  assert.equal(clearPerValueThumbnailSizeOverrides(original), original);
});
