import { createWorkspaceDragPreview, finishWorkspacePointerDrag, type WorkspacePointerDrag } from '@/lib/products/workspaceDragPreview';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { EyeOff, GripVertical, Pencil, Plus } from 'lucide-react';
import { WORKSPACE_EDITOR_ACTION, WORKSPACE_EDITOR_STATE, type WorkspaceEditAction } from '@/lib/products/productWorkspaceEditing';
import '@/styles/workspacePreviewEditor.css';
import { EditorContext, WorkspaceSourcesContext, type EditorState } from './workspacePreviewContext';

export function WorkspacePreviewEditor({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== WORKSPACE_EDITOR_STATE) return;
      if (typeof event.data.productId === 'string' && Array.isArray(event.data.groups)) setState(event.data);
    };
    let productId: string | undefined;
    let previousHeight = 0;
    let scheduled = 0;
    const measure = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(() => {
        const content = document.querySelector('.product-workspace-customer-preview, .product-workspace-card-preview');
        if (!content || !productId) return;
        const height = Math.ceil(content.getBoundingClientRect().bottom + window.scrollY + 18);
        if (height !== previousHeight) {
          previousHeight = height;
          window.parent.postMessage({ type: 'WORKSPACE_PREVIEW_HEIGHT', productId, height }, window.location.origin);
        }
      });
    };
    const sizeObserver = new ResizeObserver(measure);
    const observeContent = () => {
      const content = document.querySelector('.product-workspace-customer-preview, .product-workspace-card-preview');
      if (content) sizeObserver.observe(content);
      measure();
    };
    const contentObserver = new MutationObserver(observeContent);
    contentObserver.observe(document.body, { childList: true, subtree: true });
    const receiveSize = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== WORKSPACE_EDITOR_STATE) return;
      productId = event.data.productId; observeContent();
    };
    window.addEventListener('message', receiveSize);
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('message', receiveSize); sizeObserver.disconnect(); contentObserver.disconnect(); cancelAnimationFrame(scheduled); };
  }, []);
  return <WorkspaceSourcesContext.Provider value={state}><EditorContext.Provider value={enabled && state ? { ...state, dragTargetId, setDragTargetId } : null}>{children}</EditorContext.Provider></WorkspaceSourcesContext.Provider>;
}
/** Rendered only inside the authenticated product workspace preview. */
export function WorkspaceEditableSection({ id, children, hidden = false, matrix = false }: { id: string; children: ReactNode; hidden?: boolean; matrix?: boolean }) {
  const editor = useContext(EditorContext);
  const pointerDrag = useRef<WorkspacePointerDrag | null>(null);
  const suppressClick = useRef(false);
  if (!editor) return hidden ? null : <>{children}</>;
  const group = editor.groups.find(item => item.id === id);
  if (!group) return hidden ? null : <>{children}</>;
  const movable = editor.groups.filter(item => !item.matrix);
  const send = (action: WorkspaceEditAction['action'], targetId?: string) => window.parent.postMessage({ type: WORKSPACE_EDITOR_ACTION, productId: editor.productId, groupId: id, action, targetId }, window.location.origin);
  return <div className="workspace-edit-section" data-workspace-edit-section={id} data-workspace-hidden={hidden || undefined} data-editor-selected={editor.selectedId === id || undefined} data-drop-over={editor.dragTargetId === id || undefined}>
    <div className="workspace-edit-toolbar" data-workspace-editor-control="true" role="group" aria-label={`Rediger ${group.title}`}>
      <button type="button" data-product-option-styled="true" className="workspace-edit-title" data-movable={!matrix || undefined} onPointerDown={event => {
        if (matrix || event.button !== 0) return;
        suppressClick.current = false;
        pointerDrag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={event => {
        const start = pointerDrag.current;
        if (!start || start.pointerId !== event.pointerId || !(event.buttons & 1) || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
        if (start.preview?.cancelled) return;
        start.moved = true;
        start.preview ||= createWorkspaceDragPreview(event.currentTarget.closest('[data-workspace-edit-section]') as HTMLElement, start.x, start.y);
        start.preview.move(event.clientX, event.clientY);
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-workspace-edit-section]')?.getAttribute('data-workspace-edit-section');
        editor.setDragTargetId?.(target && target !== id && movable.some(item => item.id === target) ? target : null);
      }} onPointerUp={event => {
        if (pointerDrag.current?.pointerId !== event.pointerId) return;
        const { drag: start, cancelled } = finishWorkspacePointerDrag(pointerDrag);
        suppressClick.current = Boolean(start?.moved);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-workspace-edit-section]')?.getAttribute('data-workspace-edit-section');
        if (start?.moved && !cancelled && target && target !== id && movable.some(item => item.id === target)) send('swap', target);
        editor.setDragTargetId?.(null);
      }} onPointerCancel={() => { finishWorkspacePointerDrag(pointerDrag); suppressClick.current = false; editor.setDragTargetId?.(null); }} onLostPointerCapture={() => { finishWorkspacePointerDrag(pointerDrag); editor.setDragTargetId?.(null); }} onClick={event => { const wasDragClick = suppressClick.current && event.detail > 0; suppressClick.current = false; if (wasDragClick) return; send('select'); }} onKeyDown={event => {
        if (!matrix && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); send(event.key === 'ArrowUp' ? 'up' : 'down'); }
      }} aria-label={`Rediger ${group.title}`} title={matrix ? 'Klik for at redigere valg i pristabellen' : 'Klik for at redigere · Hold og træk for at bytte plads · Alt + pil op/ned'}>
        {matrix ? <Pencil size={12} /> : <GripVertical size={13} />}<span>{group.title}</span>{hidden && <small><EyeOff size={11} />Skjult</small>}{matrix && <small>Pristabel</small>}
      </button>
      <button type="button" data-product-option-styled="true" className="workspace-edit-add" onClick={() => send('add')} aria-label={`Tilføj valg til ${group.title}`} title="Tilføj fra banken"><Plus size={14} /></button>
    </div>
    {hidden && <span className="workspace-hidden-note"><EyeOff size={12} />Skjult for kunden</span>}
    {!group.options.length ? <button type="button" className="workspace-edit-empty" data-workspace-editor-control="true" onClick={() => send('add')}><Plus size={18} />Tilføj valg</button> : children || (hidden ? <button type="button" className="workspace-edit-hidden" data-workspace-editor-control="true" onClick={() => send('select')}>Skjult for kunden · Klik for at redigere</button> : null)}
  </div>;
}
