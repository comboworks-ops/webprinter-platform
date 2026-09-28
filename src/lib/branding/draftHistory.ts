/** Local, bounded history. Never calls storage or changes the published version. */
export interface DraftHistory<T> {
  present: T;
  past: T[];
  future: T[];
  group?: string;
  at: number;
}
export type DraftAction<T> =
  | { type: 'edit'; value: T | ((previous: T) => T); at?: number; group?: string }
  | { type: 'load'; value: T }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'checkpoint' };
// Only consecutive edits to the same scalar field coalesce (typing / dragging).
function editField(before: unknown, after: unknown, path = ''): string | undefined {
  if (before === after) return undefined;
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') {
    return typeof after === 'string' || typeof after === 'number' ? path : '*';
  }
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let result: string | undefined;
  for (const key of keys) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    const next = editField(a[key], b[key], `${path}.${key}`);
    if (result || next === '*') return '*';
    result = next;
  }
  return result;
}
export const createDraftHistory = <T>(present: T): DraftHistory<T> => ({ present, past: [], future: [], at: 0 });
export function draftHistoryReducer<T>(state: DraftHistory<T>, action: DraftAction<T>): DraftHistory<T> {
  if (action.type === 'load') return createDraftHistory(action.value);
  if (action.type === 'checkpoint') return { ...state, group: undefined, at: 0 };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future], at: 0 };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { present: state.future[0], past: [...state.past, state.present].slice(-50), future: state.future.slice(1), at: 0 };
  }
  const present = typeof action.value === 'function' ? (action.value as (previous: T) => T)(state.present) : action.value;
  if (JSON.stringify(present) === JSON.stringify(state.present)) return state;
  const at = action.at ?? 0;
  const field = action.group ? editField(state.present, present) : undefined;
  const group = field && field !== '*' ? field : undefined;
  const coalesce = group && state.group === group && at - state.at < 600 && state.future.length === 0;
  return { present, past: coalesce ? state.past : [...state.past, state.present].slice(-50), future: [], group, at };
}
