import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rollFoldPose, rollFoldUv, type RollFoldArtwork, type RollFoldDefinition } from '@/lib/mockup/rollFoldDefinition';
import { loadArtworkImage } from '@/lib/mockup/artwork';
import './flatPrintViewer.css';
import './halfFoldViewer.css';
import './rollFoldViewer.css';

type View = 'front' | 'back' | 'angle';
type Api = { view: (view: View) => void; zoom: (factor: number) => void; rotate: (x: number, y: number) => void };

export default function RollFoldViewer({ definition: d, artwork }: { definition: RollFoldDefinition; artwork: RollFoldArtwork }) {
  const host = useRef<HTMLDivElement>(null), api = useRef<Api | null>(null);
  const [opening, setOpening] = useState(65), [playing, setPlaying] = useState(false);
  const openingRef = useRef(opening);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => { openingRef.current = opening; }, [opening]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 9000);
      setOpening(50 + 50 * Math.cos(progress * Math.PI * 2));
      if (progress < 1) frame = requestAnimationFrame(tick); else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined, orbit: OrbitControls | undefined, observer: ResizeObserver | undefined;
    const resources: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(resource: T) => { resources.push(resource); return resource; };
    const failed = () => { if (!disposed) { setReady(false); setPlaying(false); setError('3D er ikke tilgængelig her. Begge trykopslag vises nedenfor.'); } };
    const lost = (event: Event) => { event.preventDefault(); failed(); };
    setReady(false); setError('');
    async function start() {
      const images = await Promise.all([loadArtworkImage(artwork.inside), loadArtworkImage(artwork.outside)]);
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
      renderer.domElement.addEventListener('webglcontextlost', lost); element!.append(renderer.domElement);
      const scene = new THREE.Scene(), root = new THREE.Group(), cover = new THREE.Group(), flap = new THREE.Group();
      scene.add(root); root.add(cover, flap);
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 2000);
      orbit = new OrbitControls(camera, renderer.domElement); orbit.enablePan = false; orbit.enableDamping = true;
      const textures = images.map(image => {
        const texture = keep(new THREE.Texture(image)); texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer!.capabilities.getMaxAnisotropy()); return texture;
      });
      const [frontWidth, centreWidth, flapWidth] = d.panelWidthsMm;
      const h = d.heightMm, t = d.displayThicknessMm;
      const initialPose = rollFoldPose(100, d);
      cover.position.z = initialPose.coverHingeZ;
      flap.position.set(centreWidth, 0, initialPose.flapHingeZ);
      const faceMaterials = textures.map(map => keep(new THREE.MeshBasicMaterial({ map, side: THREE.FrontSide })));
      const edgeMaterial = keep(new THREE.MeshBasicMaterial({ color: 0xe8e7d8 }));
      const hiddenMaterial = keep(new THREE.MeshBasicMaterial({ visible: false }));
      const lineMaterial = keep(new THREE.LineBasicMaterial({ color: 0x56736a, transparent: true, opacity: .35 }));
      const leaves = [
        { group: cover, w: frontWidth, centreX: -frontWidth / 2, centreZ: -initialPose.coverHingeZ, sheetX: 0 },
        { group: root, w: centreWidth, centreX: centreWidth / 2, centreZ: 0, sheetX: frontWidth },
        { group: flap, w: flapWidth, centreX: flapWidth / 2, centreZ: -initialPose.flapHingeZ, sheetX: frontWidth + centreWidth },
      ];
      for (const { group, w, centreX, centreZ, sheetX } of leaves) {
        const bodyGeometry = keep(new THREE.BoxGeometry(w, h, t));
        // Only the four edges belong to the body. Each printed face has its own texture.
        const body = new THREE.Mesh(bodyGeometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, hiddenMaterial, hiddenMaterial]);
        body.position.set(centreX, 0, centreZ); group.add(body);
        const outline = new THREE.LineSegments(keep(new THREE.EdgesGeometry(bodyGeometry)), lineMaterial);
        outline.position.copy(body.position); group.add(outline);
        for (const side of [0, 1]) {
          const geometry = keep(new THREE.PlaneGeometry(w, h));
          if (side === 1) geometry.rotateY(Math.PI);
          const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) + w / 2 + sheetX, y = h / 2 - positions.getY(i);
            const [u, v] = rollFoldUv(x, y, side === 0 ? 'inside' : 'outside', d); uv.setXY(i, u, v);
          }
          const mesh = new THREE.Mesh(geometry, faceMaterials[side]);
          mesh.position.set(centreX, 0, centreZ + (side === 0 ? 1 : -1) * (t / 2 + .002)); group.add(mesh);
        }
      }
      let displayedOpening = openingRef.current, selectedView: View = 'angle';
      const fit = () => Math.max(h, (frontWidth + centreWidth + flapWidth) / Math.max(.1, camera.aspect)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.42;
      const view = (next: View) => {
        selectedView = next; const distance = fit(); orbit!.target.set(0, 0, 15);
        orbit!.minDistance = distance * .5; orbit!.maxDistance = distance * 3;
        camera.position.copy(new THREE.Vector3(next === 'angle' ? .3 : 0, next === 'angle' ? .16 : 0, next === 'back' ? -1 : 1).normalize().multiplyScalar(distance).add(orbit!.target)); orbit!.update();
      };
      api.current = {
        view,
        zoom: factor => { const offset = camera.position.clone().sub(orbit!.target); offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, orbit!.minDistance, orbit!.maxDistance)); camera.position.copy(orbit!.target).add(offset); orbit!.update(); },
        rotate: (x, y) => { const offset = camera.position.clone().sub(orbit!.target), s = new THREE.Spherical().setFromVector3(offset); s.theta += x; s.phi = THREE.MathUtils.clamp(s.phi + y, .05, Math.PI - .05); camera.position.copy(orbit!.target).add(offset.setFromSpherical(s)); orbit!.update(); },
      };
      const resize = () => { const b = element!.getBoundingClientRect(); renderer!.setSize(Math.max(1, b.width), Math.max(1, b.height)); camera.aspect = Math.max(1, b.width) / Math.max(1, b.height); camera.updateProjectionMatrix(); view(selectedView); };
      resize(); observer = new ResizeObserver(resize); observer.observe(element!);
      let previous = performance.now();
      const animate = (now: number) => {
        if (disposed) return;
        const dt = Math.min(.1, (now - previous) / 1000); previous = now;
        displayedOpening += (openingRef.current - displayedOpening) * (1 - Math.exp(-12 * dt));
        const pose = rollFoldPose(displayedOpening, d);
        cover.rotation.y = pose.coverAngle; flap.rotation.y = pose.flapAngle;
        root.position.x = -pose.centreX;
        orbit!.update(); renderer!.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      setReady(true); frame = requestAnimationFrame(animate);
    }
    void start().catch(failed);
    return () => { disposed = true; cancelAnimationFrame(frame); api.current = null; observer?.disconnect(); orbit?.dispose(); resources.forEach(r => r.dispose()); renderer?.domElement.removeEventListener('webglcontextlost', lost); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); };
  }, [artwork, d]);

  function preset(percent: number, view: View) { setPlaying(false); setOpening(percent); api.current?.view(view); }
  return <div className="flat-print-viewer roll-fold-viewer" data-roll-fold-ready={ready} data-model-revision={d.id}>
    <div ref={host} className="flat-print-stage" tabIndex={error ? -1 : 0} role="group" aria-label="3D-rullefolder. Piletaster drejer. Plus og minus zoomer."
      onKeyDown={e => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(e.key)) return; e.preventDefault(); if (e.key.startsWith('Arrow')) api.current?.rotate(e.key === 'ArrowLeft' ? -.15 : e.key === 'ArrowRight' ? .15 : 0, e.key === 'ArrowUp' ? -.15 : e.key === 'ArrowDown' ? .15 : 0); else api.current?.zoom(e.key === '-' ? 1.12 : .89); }} />
    {!ready && !error && <p role="status">Åbner 3D…</p>}
    {error ? <div className="flat-print-fallback"><p role="alert">{error}</p><img src={artwork.outside} alt="Yderside: indstik 5, bagside 6 og forside 1" /><img src={artwork.inside} alt="Inderside: side 2, 3 og 4" /></div> : <>
      <div className="half-fold-slider"><label htmlFor="fold-opening">Åbning <strong>{Math.round(opening)} %</strong></label><input id="fold-opening" type="range" min="0" max="100" step="1" value={opening} disabled={!ready} onChange={e => { setPlaying(false); setOpening(Number(e.target.value)); }} /><div><span>Lukket</span><span>Helt åben</span></div></div>
      <p className="roll-fold-step">{opening > 50 ? 'Trin 1: Det smalle indstik foldes ind over midten.' : opening > 0 ? 'Trin 2: Forsiden lukkes over indstikket.' : 'Lukket: Forsiden er yderst, og indstikket ligger inde i folderen.'}</p>
      <div className="flat-print-controls" aria-label="Foldning og sider">
        <button disabled={!ready} onClick={() => preset(100, 'front')}>Åben · 2–3–4</button>
        <button disabled={!ready} onClick={() => preset(50, 'front')}>Trin 1 · Indstik ind</button>
        <button disabled={!ready} onClick={() => preset(0, 'front')}>Trin 2 · Forside 1</button>
        <button disabled={!ready} onClick={() => preset(0, 'back')}>Bagside · 6</button>
        <button disabled={!ready} onClick={() => preset(100, 'back')}>Yderside · 5–6–1</button>
        <button disabled={!ready} onClick={() => preset(65, 'angle')}>3D-vinkel</button>
        <button disabled={!ready} onClick={() => { if (!playing) { api.current?.view('angle'); setOpening(100); } setPlaying(v => !v); }}>{playing ? 'Pause foldning' : 'Afspil foldning'}</button>
        <button disabled={!ready} aria-label="Zoom ind" onClick={() => api.current?.zoom(.85)}>+</button><button disabled={!ready} aria-label="Zoom ud" onClick={() => api.current?.zoom(1.18)}>−</button>
      </div>
    </>}
  </div>;
}
