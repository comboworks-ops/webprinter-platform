import { useCallback, useLayoutEffect, useState } from 'react';
import { resolveHeaderMode, type HeaderMode } from '@/lib/layout/headerFit';

/** Measure the real, unshrunk desktop groups. Compact groups stay inert and
 * measurable; no second copy of links is needed just to calculate their width. */
export function useHeaderFit({ centered = false, minimumDesktopWidth = 1200, clearance = 24, allowStackedDesktop = false } = {}) {
  const [row, setRow] = useState<HTMLElement | null>(null);
  const [logo, setLogo] = useState<HTMLElement | null>(null);
  const [navigation, setNavigation] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<HeaderMode>('compact');
  const compact = mode === 'compact';
  const rowRef = useCallback((element: HTMLElement | null) => setRow(element), []);
  const logoRef = useCallback((element: HTMLElement | null) => setLogo(element), []);
  const navigationRef = useCallback((element: HTMLElement | null) => setNavigation(element), []);
  const actionsRef = useCallback((element: HTMLElement | null) => setActions(element), []);

  useLayoutEffect(() => {
    const focusedElement = document.activeElement;
    if (compact && focusedElement && [navigation, actions].some(element => element?.contains(focusedElement))) {
      row?.querySelector<HTMLElement>('[data-header-toggle]')?.focus();
    }
    for (const element of [navigation, actions]) {
      if (element) element.inert = compact;
    }
  }, [row, navigation, actions, compact]);

  useLayoutEffect(() => {
    if (!row || !logo || !navigation || !actions) return;
    let frame = 0;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const style = getComputedStyle(row);
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      setMode(previousMode => resolveHeaderMode({
        viewportWidth: window.innerWidth,
        availableWidth: row.clientWidth - padding,
        logoWidth: Math.max(logo.scrollWidth, logo.getBoundingClientRect().width),
        navigationWidth: navigation.getBoundingClientRect().width,
        actionsWidth: actions.getBoundingClientRect().width,
        centered, previousMode, minimumDesktopWidth, clearance, allowStackedDesktop,
      }));
    };
    const schedule = () => { if (cancelled) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    for (const element of [row, logo, navigation, actions]) observer.observe(element);
    window.addEventListener('resize', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    void document.fonts?.ready.then(schedule);
    measure();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [row, logo, navigation, actions, centered, minimumDesktopWidth, clearance, allowStackedDesktop]);

  return { mode, compact, stacked: mode === 'stacked', rowRef, logoRef, navigationRef, actionsRef };
}
