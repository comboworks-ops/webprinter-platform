import { useEffect, useRef } from 'react';
import { ADMIN_WORKSPACE_EXIT_EVENT } from '@/lib/admin/workspaceExit';

/** The product shell asks before unmounting an editor with unsaved setup. */
export function useProductSetupGuard(snapshot: string, ready: boolean) {
  const baseline = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) baseline.current = null;
    else if (baseline.current === null) baseline.current = snapshot;
  }, [snapshot, ready]);
  useEffect(() => {
    const dirty = () => ready && baseline.current !== null && snapshot !== baseline.current;
    const leave = (event: Event) => {
      if (dirty() && !window.confirm('Du har ugemte ændringer. Forlad produktet?')) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener(ADMIN_WORKSPACE_EXIT_EVENT, leave);
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener(ADMIN_WORKSPACE_EXIT_EVENT, leave); window.removeEventListener('beforeunload', unload); };
  }, [snapshot, ready]);
  return () => { baseline.current = snapshot; };
}
