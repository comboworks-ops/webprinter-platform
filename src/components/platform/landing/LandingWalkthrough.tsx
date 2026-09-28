import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pause, PenLine, Play, ShoppingBag } from 'lucide-react';
const DURATION = 18;
const CHAPTERS = [
  { title: 'Vælg produkt', icon: ShoppingBag, time: 0 },
  { title: 'Tilpas design', icon: PenLine, time: 6 },
  { title: 'Modtag ordre', icon: Check, time: 12 },
];
/** Playback UI is separate from the deterministic, seekable Hyperframes composition. */
export function LandingWalkthrough() {
  const frame = useRef<HTMLIFrameElement>(null);
  const elapsed = useRef(6);
  const [time, setTime] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const active = Math.min(2, Math.floor(time / 6));
  const seek = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(DURATION, next));
    elapsed.current = clamped;
    setTime(clamped);
    frame.current?.contentWindow?.postMessage({ type: 'webprinter-tour-seek', time: clamped }, window.location.origin);
  }, []);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'webprinter-tour-ready') { setReady(true); seek(elapsed.current); }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [seek]);
  useEffect(() => {
    if (!playing || !ready) return;
    let request: number;
    let previous: number | undefined;
    const tick = (now: number) => {
      const delta = previous === undefined ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const next = Math.min(elapsed.current + delta, DURATION);
      seek(next);
      if (next >= DURATION) setPlaying(false);
      else request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const onVisibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelAnimationFrame(request); document.removeEventListener('visibilitychange', onVisibility); };
  }, [playing, ready, seek]);
  const togglePlayback = () => {
    if (!playing && elapsed.current >= DURATION) seek(0);
    setPlaying(value => !value);
  };
  return (
    <figure className="wp-tour">
      <div className="wp-tour-surface">
        <div className="wp-tour-chapters" aria-label="Vælg trin i gennemgangen">
          {CHAPTERS.map((chapter, index) => <button key={chapter.title} type="button" className={active === index ? 'is-active' : ''} aria-pressed={active === index} disabled={!ready} onClick={() => { setPlaying(false); seek(chapter.time); }}><span className="wp-chapter-icon"><chapter.icon size={19} aria-hidden="true" /></span><span>{chapter.title}</span></button>)}
        </div>
        <div className="wp-tour-frame">
          {!ready && <img src="/platform/landing/designer.webp" alt="Eksempel på online designeren" width="1505" height="1045" />}
          <iframe ref={frame} title="Illustrativ gennemgang af produktvalg, designer og ordre" src="/platform/landing/motion/index.html" loading="lazy" tabIndex={-1} style={{ opacity: ready ? 1 : 0 }} />
        </div>
        <div className="wp-tour-controls">
          <button className="wp-play" type="button" disabled={!ready} onClick={togglePlayback} aria-label={playing ? 'Sæt gennemgang på pause' : 'Afspil gennemgang'}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}</button>
          <input type="range" min="0" max={DURATION} step="0.05" value={time} disabled={!ready} aria-label="Gennemgangens tidslinje" aria-valuetext={`${CHAPTERS[active].title}, ${Math.round(time)} af ${DURATION} sekunder`} onChange={event => { setPlaying(false); seek(Number(event.target.value)); }} />
          <span className="wp-tour-time">{String(Math.floor(time)).padStart(2, '0')} / 18 s</span>
        </div>
      </div>
      <figcaption>Illustrativ demo <span>·</span> {CHAPTERS[active].title}</figcaption>
    </figure>
  );
}
