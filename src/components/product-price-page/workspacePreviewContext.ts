import { createWorkspaceDragPreview, finishWorkspacePointerDrag, type WorkspacePointerDrag } from '@/lib/products/workspaceDragPreview';
import { createContext, useContext, useRef, type ButtonHTMLAttributes } from 'react';
import type { ProductAttributeGroup } from '@/hooks/useProductAttributes';
import { WORKSPACE_EDITOR_ACTION } from '@/lib/products/productWorkspaceEditing';
export type EditorState = { sourceGroups?: ProductAttributeGroup[]; dragTargetId?: string | null; setDragTargetId?: (id: string | null) => void; productId: string; selectedId: string | null; groups: { id: string; title: string; matrix: boolean; options: { sectionId: string; valueId: string }[] }[] };
export const WorkspaceSourcesContext = createContext<Pick<EditorState, 'productId' | 'sourceGroups'> | null>(null);
export function useWorkspacePreviewSources(productId: string) { const state = useContext(WorkspaceSourcesContext); return state?.productId === productId ? state.sourceGroups : undefined; }
export const EditorContext = createContext<EditorState | null>(null);
export function useWorkspacePreviewEditing() { return useContext(EditorContext) !== null; }

export function useWorkspaceOptionEditing(target?: string): ButtonHTMLAttributes<HTMLButtonElement> & { 'data-workspace-editor-control'?: string } {
  const editor = useContext(EditorContext);
  const pointerDrag = useRef<WorkspacePointerDrag | null>(null);
  const suppressClick = useRef(false);
  const parts = target?.split('.');
  const sectionId = parts?.[2]; const valueId = parts?.[3];
  const group = parts?.[0] === 'product-option' && editor?.groups.find(item => item.options.some(option => option.sectionId === sectionId && option.valueId === valueId));
  if (!editor || !group) return {};
  return {
    'data-workspace-editor-control': 'true',
    onClick: event => { event.preventDefault(); event.stopPropagation(); const wasDragClick = suppressClick.current && event.detail > 0; suppressClick.current = false; if (wasDragClick) return; window.parent.postMessage({ type: WORKSPACE_EDITOR_ACTION, productId: editor.productId, groupId: group.id, sectionId, valueId, action: 'select' }, window.location.origin); },
    draggable: false, disabled: false, title: 'Klik for at redigere · Træk til et andet valg for at ændre rækkefølgen',
    onPointerDown: event => {
      if (event.button !== 0) return;
      suppressClick.current = false;
      pointerDrag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: event => {
      const start = pointerDrag.current;
      if (!start || start.pointerId !== event.pointerId || !(event.buttons & 1) || start.preview?.cancelled || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 6) return;
      start.moved = true;
      start.preview ||= createWorkspaceDragPreview(event.currentTarget, start.x, start.y);
      start.preview.move(event.clientX, event.clientY);
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-site-design-target^="product-option."]');
      const destination = target?.getAttribute('data-site-design-target')?.split('.');
      if (start.target) delete start.target.dataset.workspaceOptionDrop;
      start.target = destination && group.options.some(option => option.sectionId === destination[2] && option.valueId === destination[3]) && target !== event.currentTarget ? target : null;
      if (start.target) start.target.dataset.workspaceOptionDrop = 'true';
    },
    onPointerUp: event => {
      if (pointerDrag.current?.pointerId !== event.pointerId) return;
      const { drag: start, cancelled } = finishWorkspacePointerDrag(pointerDrag);
      suppressClick.current = Boolean(start?.moved);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!start?.moved || cancelled) return;
      const destination = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-site-design-target^="product-option."]')?.getAttribute('data-site-design-target')?.split('.');
      if (!destination || !group.options.some(option => option.sectionId === destination[2] && option.valueId === destination[3])) return;
      window.parent.postMessage({ type: WORKSPACE_EDITOR_ACTION, productId: editor.productId, groupId: group.id, sectionId, valueId, action: 'option-before', targetId: `${destination[2]}:${destination[3]}` }, window.location.origin);
    },
    onPointerCancel: () => { finishWorkspacePointerDrag(pointerDrag); suppressClick.current = false; },
    onLostPointerCapture: () => { finishWorkspacePointerDrag(pointerDrag); },
  };
}
