import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Keep the desktop composition while reflowing print content before it becomes unreadable. */
export function FeaturedProductCanvas({ fixed, minReadableWidth = 0, children }: { fixed: boolean; minReadableWidth?: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 0, scale: 1, available: 0 });
  const useFixed = fixed && (!minReadableWidth || size.available >= minReadableWidth);
  useLayoutEffect(() => {
    if (!fixed || !frame.current || !canvas.current) return;
    const measure = () => {
      const available = frame.current?.clientWidth || 0;
      const width = 1200;
      const scale = available / width;
      const height = canvas.current?.offsetHeight || 0;
      setSize(previous => previous.width === width && previous.height === height && previous.scale === scale && previous.available === available ? previous : { width, height, scale, available });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current); observer.observe(canvas.current); measure();
    return () => observer.disconnect();
  }, [fixed, minReadableWidth]);
  return <div ref={frame} className="featured-canvas-frame" style={useFixed && size.height ? { height: size.height * size.scale } : undefined}>
    <div ref={canvas} className="featured-canvas" data-layout={useFixed ? 'fixed' : 'compact'}
      style={useFixed ? { width: size.width, transform: `scale(${size.scale})`, transformOrigin: 'top left' } : undefined}>{children}</div>
  </div>;
}
