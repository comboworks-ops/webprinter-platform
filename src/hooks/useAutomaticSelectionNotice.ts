import { useEffect, useRef, useState } from 'react';
import { automaticSelectionChanges, type SelectionSnapshot } from '@/lib/products/automaticSelectionNotice';

export function useAutomaticSelectionNotice(productId: string, snapshot: SelectionSnapshot) {
  const pending = useRef<{ productId: string; before: SelectionSnapshot; manualKeys: string[] } | null>(null);
  const [notice, setNotice] = useState<{ productId: string; changes: string[] } | null>(null);
  const serialized = JSON.stringify(snapshot);

  useEffect(() => {
    const action = pending.current;
    if (!action) return;
    if (action.productId !== productId) {
      pending.current = null;
      setNotice(null);
      return;
    }
    const current: SelectionSnapshot = JSON.parse(serialized);
    const changes = automaticSelectionChanges(action.before, current, action.manualKeys);
    setNotice(changes.length ? { productId, changes } : null);
    // Retain the action baseline while dependent effects settle, so material and
    // quantity changes from the same click appear together. Initial load is silent.
  }, [productId, serialized]);

  return {
    changes: notice?.productId === productId ? notice.changes : [],
    beginSelection: (manualKeys: string[]) => {
      pending.current = { productId, before: snapshot, manualKeys };
      setNotice(null);
    },
  };
}
