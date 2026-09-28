// Host-only preview adapter. The Hyperframes timeline remains deterministic and paused.
const initializeWebprinterPreview = () => {
  const root = document.getElementById('tour');
  if (!root) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resize = () => { root.style.transform = `scale(${window.innerWidth / 1440})`; };
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.type !== 'webprinter-tour-seek' || !Number.isFinite(event.data.time)) return;
    const time = Math.max(0, Math.min(18, event.data.time));
    // Reduced motion changes chapters instantly; no camera or receipt movement.
    const target = reduced.matches ? (time < 6 ? 0 : time < 12 ? 6 : 12.6) : time;
    window.__timelines?.['webprinter-order-flow']?.seek(target, true);
    ['storefront-scene', 'designer-scene', 'order-scene'].forEach((id, index) => { document.getElementById(id)?.setAttribute('aria-hidden', String(index !== Math.min(2, Math.floor(time / 6)))); });
  });
  if (window.parent !== window) window.parent.postMessage({ type: 'webprinter-tour-ready' }, window.location.origin);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeWebprinterPreview, { once: true });
else initializeWebprinterPreview();
