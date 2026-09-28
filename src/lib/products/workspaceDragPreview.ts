/** A visual copy keeps the original slot and hit targets stable during a drag.
 * Computed styles preserve product-specific button and section appearance. */
export function createWorkspaceDragPreview(source: HTMLElement, startX: number, startY: number) {
  const document = source.ownerDocument;
  const view = document.defaultView!;
  document.querySelectorAll('[data-workspace-drag-preview]').forEach(element => element.remove());
  const bounds = source.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [ghost, ...ghost.querySelectorAll('*')];
  copies.forEach((copy, index) => {
    const style = view.getComputedStyle(originals[index]);
    const element = copy as HTMLElement | SVGElement;
    for (const property of style) element.style.setProperty(property, style.getPropertyValue(property));
    for (const attribute of [...copy.attributes]) {
      if (attribute.name === 'id' || attribute.name.startsWith('data-')) copy.removeAttribute(attribute.name);
    }
    element.style.pointerEvents = 'none';
    element.style.transition = 'none';
    element.style.animation = 'none';
  });
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.dataset.workspaceDragPreview = 'true';
  Object.assign(ghost.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px`, margin: '0',
    zIndex: '2147483647', opacity: '.96', transform: 'translate3d(0,0,0)',
    boxShadow: '0 14px 36px #102f5940', willChange: 'transform',
  });
  document.body.appendChild(ghost);
  source.dataset.workspaceDragging = 'true';
  let done = false;
  const abort = new AbortController();
  const finish = () => {
    if (done) return;
    done = true;
    abort.abort();
    delete source.dataset.workspaceDragging;
    ghost.remove();
  };
  // Reordering can unmount the captured source. The visual drag must end with
  // the pointer, independently of the source's lifecycle or an animation promise.
  document.addEventListener('pointerup', finish, { signal: abort.signal });
  document.addEventListener('pointercancel', finish, { signal: abort.signal });
  view.addEventListener('blur', () => finish(), { signal: abort.signal });
  view.addEventListener('pagehide', () => finish(), { signal: abort.signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') finish(); }, { signal: abort.signal });
  return {
    get cancelled() { return done; },
    move(x: number, y: number) {
      if (done) return;
      const dx = x - startX; const dy = y - startY;
      ghost.style.transform = `translate3d(${dx}px,${dy}px,0)`;
    },
    finish,
  };
}

export type WorkspacePointerDrag = {
  x: number; y: number; pointerId: number; moved: boolean;
  preview?: ReturnType<typeof createWorkspaceDragPreview>;
  target?: HTMLElement | null;
};

/** End a pointer gesture before the next hover event can reuse it. */
export function finishWorkspacePointerDrag<T extends WorkspacePointerDrag>(ref: { current: T | null }) {
  const drag = ref.current;
  ref.current = null;
  const cancelled = drag?.preview?.cancelled ?? false;
  if (drag?.target) delete drag.target.dataset.workspaceOptionDrop;
  drag?.preview?.finish();
  return { drag, cancelled };
}
