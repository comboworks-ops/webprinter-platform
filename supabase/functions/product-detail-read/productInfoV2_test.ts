import { readProductInfoV2 } from "./productInfoV2.ts";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${message}\nExpected: ${expectedJson}\nActual: ${actualJson}`,
    );
  }
}

Deno.test("product detail keeps gallery layout and scoped visibility", () => {
  const result = readProductInfoV2({
    product_page_info_v2: {
      useSections: true,
      imagePosition: "below",
      blocks: [{
        id: "calendar-gallery",
        type: "gallery",
        images: ["model-a.png", "", 42, "model-b.png"],
        galleryLayout: "grid",
        gallerySize: "large",
        showWhen: [
          {
            sectionId: " calendar-model ",
            valueIds: ["model-a, model-b", "model-a"],
          },
          { sectionId: "filling", valueIds: ["lindt\nmerci"] },
        ],
      }],
    },
  });

  assertEquals(result, {
    useSections: true,
    imagePosition: "below",
    blocks: [{
      id: "calendar-gallery",
      type: "gallery",
      title: "",
      text: "",
      imageUrl: "",
      caption: "",
      images: ["model-a.png", "model-b.png"],
      effect: "fade",
      intervalMs: 4500,
      format: "",
      configuration: "",
      placement: "left",
      galleryLayout: "grid",
      gallerySize: "large",
      showWhen: [
        { sectionId: "calendar-model", valueIds: ["model-a", "model-b"] },
        { sectionId: "filling", valueIds: ["lindt", "merci"] },
      ],
    }],
  }, "gallery configuration was stripped or changed");
});

Deno.test("product detail keeps guide blocks and their placement metadata", () => {
  const result = readProductInfoV2({
    product_page_info_v2: {
      blocks: [{
        id: "calendar-guide",
        type: "guide",
        title: "Trykguide",
        imageUrl: "guide.png",
        format: "A4",
        configuration: "5 mm ryg",
        placement: "right",
      }],
    },
  });

  assertEquals(result.blocks, [{
    id: "calendar-guide",
    type: "guide",
    title: "Trykguide",
    text: "",
    imageUrl: "guide.png",
    caption: "",
    images: [],
    effect: "fade",
    intervalMs: 4500,
    format: "A4",
    configuration: "5 mm ryg",
    placement: "right",
  }], "guide block was omitted or lost its matching metadata");
});

Deno.test("product detail rejects unsupported blocks and normalizes unsafe gallery values", () => {
  const result = readProductInfoV2({
    product_page_info_v2: {
      blocks: [
        { type: "script", text: "ignored" },
        { type: "gallery", galleryLayout: "carousel", showWhen: "invalid" },
      ],
    },
  });

  assertEquals(result.blocks, [{
    id: "block-2",
    type: "gallery",
    title: "",
    text: "",
    imageUrl: "",
    caption: "",
    images: [],
    effect: "fade",
    intervalMs: 4500,
    format: "",
    configuration: "",
    placement: "left",
    galleryLayout: "slideshow",
    gallerySize: "standard",
    showWhen: [],
  }], "unsupported or malformed blocks were not normalized safely");
});
