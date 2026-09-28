import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const editorCanvasSource = fs.readFileSync(
  fileURLToPath(new URL("./EditorCanvas.tsx", import.meta.url)),
  "utf8",
);
const designerPageSource = fs.readFileSync(
  fileURLToPath(new URL("../../pages/Designer.tsx", import.meta.url)),
  "utf8",
);
const productFormatGuideSource = fs.readFileSync(
  fileURLToPath(new URL("../product-price-page/ProductFormatGuide.tsx", import.meta.url)),
  "utf8",
);

test("designer production guides use the Danish Webprinter color legend", () => {
  assert.match(editorCanvasSource, /documentBackgroundStroke = '#4B5563'/);
  assert.match(editorCanvasSource, /pasteboardColor = '#525252'/);
  assert.match(editorCanvasSource, /stroke: '#EC008C'/);
  assert.match(editorCanvasSource, /stroke: '#2F80ED'/);
  assert.match(editorCanvasSource, /stroke: '#00A7C4'/);
  assert.match(editorCanvasSource, />\s*Dataformat \/ udfald\s*</);
  assert.match(editorCanvasSource, />\s*Skærelinje\s*</);
  assert.match(editorCanvasSource, />\s*Sikkerhedsafstand\s*</);
  assert.match(editorCanvasSource, /Udfaldsområde \(skæres væk\) – zoom ind ved behov/);

  assert.doesNotMatch(editorCanvasSource, /#00ff00|bg-green-500|Safe Zone|Overfill/);
});

test("designer dimensions describe bleed and safety in Danish", () => {
  assert.match(designerPageSource, /mm udfald/);
  assert.match(designerPageSource, /mm sikkerhedsafstand/);
  assert.match(designerPageSource, /Horisontal foldelinje \(G\)/);
  assert.match(designerPageSource, /Vertikal foldelinje \(Shift\+G\)/);
  assert.doesNotMatch(designerPageSource, /mm bleed|mm safe zone|Fold\/beskæring/);
  assert.match(productFormatGuideSource, /mm udfald/);
  assert.doesNotMatch(productFormatGuideSource, /mm bleed/);
});
