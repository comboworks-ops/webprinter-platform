import assert from "node:assert/strict";
import test from "node:test";

import { hideGuides, restoreGuides, withHiddenGuides } from "./hideExportGuides.ts";

const makeCanvas = () => {
  const template = {
    __isPdfTemplate: true,
    visible: true,
    excludeFromExport: true,
    canvas: null as unknown,
  };
  const artwork = {
    visible: true,
    excludeFromExport: false,
    canvas: null as unknown,
  };
  let renders = 0;
  const canvas = {
    getObjects: () => [template, artwork],
    renderAll: () => { renders += 1; },
  };
  template.canvas = canvas;
  artwork.canvas = canvas;

  return { canvas, template, artwork, renderCount: () => renders };
};

test("the technical PDF overlay is hidden for export and restored afterwards", () => {
  const fixture = makeCanvas();
  const hidden = hideGuides(fixture.canvas as never);

  assert.equal(fixture.template.visible, false);
  assert.equal(fixture.artwork.visible, true);
  assert.equal(hidden.length, 1);

  restoreGuides(hidden);
  assert.equal(fixture.template.visible, true);
  assert.equal(fixture.template.excludeFromExport, true);
  assert.equal(fixture.renderCount(), 2);
});

test("the technical PDF overlay is restored even when export fails", async () => {
  const fixture = makeCanvas();

  await assert.rejects(
    withHiddenGuides(fixture.canvas as never, async () => {
      assert.equal(fixture.template.visible, false);
      throw new Error("export failed");
    }),
    /export failed/,
  );

  assert.equal(fixture.template.visible, true);
  assert.equal(fixture.template.excludeFromExport, true);
});

for (const fails of [false, true]) {
  test(`paper keeps its fill but loses its editor outline, then restores it (${fails ? 'failure' : 'success'})`, async () => {
    const paper = {
      __isDocumentBackground: true, visible: false, excludeFromExport: true,
      fill: '#ffffff', stroke: '#4B5563', strokeWidth: 7, dirty: false,
      canvas: null as unknown,
    };
    const artwork = { stroke: '#ff0000', strokeWidth: 2, visible: true };
    const canvas = { getObjects: () => [paper, artwork], renderAll: () => {} };
    paper.canvas = canvas;
    const run = withHiddenGuides(canvas as never, async () => {
      assert.equal(paper.fill, '#ffffff');
      assert.equal(paper.visible, true);
      assert.equal(paper.excludeFromExport, false);
      assert.equal(paper.stroke, null);
      assert.equal(paper.strokeWidth, 0);
      assert.equal(artwork.stroke, '#ff0000');
      if (fails) throw new Error('capture failed');
    });
    if (fails) await assert.rejects(run, /capture failed/);
    else await run;
    assert.equal(paper.stroke, '#4B5563');
    assert.equal(paper.strokeWidth, 7);
    assert.equal(paper.visible, false);
    assert.equal(paper.excludeFromExport, true);
    assert.equal(paper.dirty, true);
  });
}
