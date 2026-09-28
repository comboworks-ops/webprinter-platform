import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import type { FeaturedProductConfig, FeaturedProductSlide } from '@/hooks/useBrandingDraft';
import { getFeaturedSlides } from '@/lib/branding/featuredProductPresentation';
import '@/styles/featuredProduct.css';

export function FeaturedProductDeck({ config, renderSlide }: { config: FeaturedProductConfig; renderSlide: (slide: FeaturedProductSlide) => ReactNode }) {
  const slides = useMemo(() => getFeaturedSlides(config).filter(slide => slide.config.productId), [config]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const selected = Math.max(0, slides.findIndex(slide => slide.id === selectedId));
  const activeId = slides[selected]?.id;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (window.parent === window || event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type !== 'SELECT_FEATURED_PRODUCT' || typeof event.data.slideId !== 'string' || event.data.slideId.length > 160) return;
      setSelectedId(event.data.slideId);
      setPaused(true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  useEffect(() => {
    if (!config.presentation?.autoPlay || paused || engaged || reducedMotion || slides.length < 2 || window.parent !== window) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setSelectedId(slides[(selected + 1) % slides.length].id);
    }, Math.max(5000, config.presentation.intervalMs || 7000));
    return () => window.clearInterval(timer);
  }, [config.presentation, engaged, paused, reducedMotion, selected, slides]);

  const select = (index: number) => {
    const slideId = slides[(index + slides.length) % slides.length].id;
    setSelectedId(slideId); setPaused(true);
    if (window.parent !== window) window.parent.postMessage({ type: 'FEATURED_PRODUCT_SELECTED', slideId }, window.location.origin);
  };
  if (!config.enabled || slides.length === 0) return null;
  return <div ref={root} className="featured-product-deck" data-presentation="carousel" role="region" aria-label="Fremhævede produkter"
    onPointerEnter={() => setEngaged(true)} onPointerLeave={() => setEngaged(false)}
    onPointerDownCapture={() => setPaused(true)} onFocusCapture={() => { setEngaged(true); setPaused(true); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setEngaged(false); }}>
    <div className="featured-product-slides">
      {slides.map((slide, index) => <div key={`${slide.id}:${slide.config.productId}`} className="featured-product-slide" data-featured-slide={slide.id}
        data-active={slide.id === activeId} aria-hidden={slide.id !== activeId}
        {...(slide.id !== activeId ? { inert: '' } as Record<string, string> : {})}
        role="group" aria-roledescription="dias" aria-label={`Produkt ${index + 1} af ${slides.length}`}>
        {renderSlide(slide)}
      </div>)}
    </div>
    {slides.length > 1 && <nav className="featured-product-navigation" aria-label="Vælg fremhævet produkt">
      <button type="button" onClick={() => select(selected - 1)} aria-label="Forrige produkt"><ChevronLeft size={18} /></button>
      <div className="featured-product-pagination">{slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Vis produkt ${index + 1}`} aria-current={slide.id === activeId ? 'true' : undefined} onClick={() => select(index)}><span /></button>)}</div>
      <span className="featured-product-count" aria-live="polite">{selected + 1} / {slides.length}</span>
      <button type="button" onClick={() => select(selected + 1)} aria-label="Næste produkt"><ChevronRight size={18} /></button>
      {config.presentation?.autoPlay && !reducedMotion && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Start automatisk skift' : 'Pause automatisk skift'}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
    </nav>}
  </div>;
}
