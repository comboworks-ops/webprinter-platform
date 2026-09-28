import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceDragPreview, finishWorkspacePointerDrag } from './workspaceDragPreview.ts';

// A minimal DOM double exercises pointer lifetime without relying on animation
// completion or React retaining the original section after it changes rows.
function fixture() {
  const view = Object.assign(new EventTarget(), { getComputedStyle: () => [] });
  const document = Object.assign(new EventTarget(), {
    defaultView: view,
    querySelectorAll: () => [],
    body: { appendChild: () => undefined },
  });
  const makeNode = () => ({
    attributes: [], dataset: {} as Record<string, string>, style: { setProperty() {}, transform: '' },
    ownerDocument: document, inert: false, removed: false,
    querySelectorAll: () => [], setAttribute() {}, removeAttribute() {},
    getBoundingClientRect: () => ({ left: 20, top: 30, width: 140, height: 48 }),
    remove() { this.removed = true; },
  });
  const ghost = makeNode();
  const source = { ...makeNode(), cloneNode: () => ghost };
  return { source, ghost, document, view, start: () => createWorkspaceDragPreview(source as unknown as HTMLElement, 30, 40) };
}
test('the copied button follows pointer displacement and preserves its size', () => {
  const { start, ghost, source } = fixture(); const drag = start();
  drag.move(130, 90);
  assert.equal(ghost.style.transform, 'translate3d(100px,50px,0)');
  assert.equal(source.dataset.workspaceDragging, 'true');
  drag.finish(); assert.equal(ghost.removed, true);
  assert.equal(source.dataset.workspaceDragging, undefined);
});
test('pointer release removes the copy even if React no longer calls the source handler', () => {
  const { start, document, ghost } = fixture(); const drag = start();
  document.dispatchEvent(new Event('pointerup'));
  assert.equal(ghost.removed, true); assert.equal(drag.cancelled, true);
  drag.move(100, 100); assert.equal(ghost.style.transform, 'translate3d(0,0,0)');
  drag.finish(); // Idempotent source/lost-capture cleanup.
});
test('pointer cancellation, Escape and window blur each clean up the copy', () => {
  for (const event of ['pointercancel', 'keydown', 'blur']) {
    const { start, document, view, ghost } = fixture(); start();
    const input = Object.assign(new Event(event), { key: 'Escape' });
    (event === 'blur' ? view : document).dispatchEvent(input);
    assert.equal(ghost.removed, true, event);
  }
});

test('releasing the mouse clears the stored drag even when no click follows', () => {
  const { start, ghost } = fixture();
  const ref = { current: { x: 30, y: 40, pointerId: 1, moved: true, preview: start() } };
  const ended = finishWorkspacePointerDrag(ref);
  assert.equal(ended.drag?.moved, true);
  assert.equal(ended.cancelled, false);
  assert.equal(ref.current, null);
  assert.equal(ghost.removed, true);
});

test('releasing a simple click also clears its pointer state', () => {
  const ref = { current: { x: 30, y: 40, pointerId: 1, moved: false } };
  const ended = finishWorkspacePointerDrag(ref);
  assert.equal(ended.drag?.moved, false);
  assert.equal(ref.current, null);
});

test('a cancelled drag cannot be dropped and leaves no highlighted target', () => {
  const { start, document } = fixture();
  const target = { dataset: { workspaceOptionDrop: 'true' } } as unknown as HTMLElement;
  const ref = { current: { x: 30, y: 40, pointerId: 1, moved: true, preview: start(), target } };
  document.dispatchEvent(new Event('pointercancel'));
  const ended = finishWorkspacePointerDrag(ref);
  assert.equal(ended.cancelled, true);
  assert.equal(ref.current, null);
  assert.equal(target.dataset.workspaceOptionDrop, undefined);
});
