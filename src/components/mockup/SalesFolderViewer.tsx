import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { salesFolderPanelAngle, salesFolderInsideUv, type SalesFolderDefinition } from '@/lib/mockup/salesFolderDefinition';
import type { PrintArtwork } from '@/lib/mockup/approvedPrintModels';
import { loadArtworkImage } from '@/lib/mockup/artwork';
import './flatPrintViewer.css';
import './halfFoldViewer.css';
import './rollFoldViewer.css';

type View = 'angle' | 'front' | 'back' | 'inside' | 'outside' | 'spine';
type Api = { view: (view: View) => void; zoom: (factor: number) => void; rotate: (x: number, y: number) => void };

/** Measured panel tree supports paired gussets, windows and separate inside artwork. */
export default function SalesFolderViewer({ definition: d, artwork }: { definition: SalesFolderDefinition; artwork: PrintArtwork }) {
  const host = useRef<HTMLDivElement>(null), api = useRef<Api | null>(null);
  const [opening, setOpening] = useState(45), [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [viewName, setViewName] = useState<View>('angle');
  const openingRef = useRef(opening);
  useEffect(() => { openingRef.current = opening; }, [opening]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0; const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 14000);
      setOpening(50 + 50 * Math.cos(progress * Math.PI * 2));
      if (progress < 1) frame = requestAnimationFrame(tick); else setPlaying(false);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    let disposed = false, frame = 0;
    let renderer: THREE.WebGLRenderer | undefined, orbit: OrbitControls | undefined, observer: ResizeObserver | undefined;
    const resources: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(r: T) => { resources.push(r); return r; };
    const failed = () => { if (!disposed) { setReady(false); setPlaying(false); setError('3D kunne ikke åbnes. Den udfoldede trykflade vises nedenfor.'); } };
    const lost = (event: Event) => { event.preventDefault(); failed(); };
    setReady(false); setError('');
    async function start() {
      const [image, innerImage] = await Promise.all([loadArtworkImage(artwork.outside), artwork.inside ? loadArtworkImage(artwork.inside) : Promise.resolve(null)]); if (disposed) return;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping; renderer.domElement.addEventListener('webglcontextlost', lost);
      element!.append(renderer.domElement);
      const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
      const camera = new THREE.PerspectiveCamera(34, 1, .1, 5000);
      orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.enablePan = false;
      const texture = keep(new THREE.Texture(image)); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const outside = keep(new THREE.MeshStandardMaterial({ map: texture, roughness: .88, side: THREE.FrontSide }));
      const innerTexture = innerImage ? keep(new THREE.Texture(innerImage)) : undefined;
      if (innerTexture) { innerTexture.needsUpdate = true; innerTexture.colorSpace = THREE.SRGBColorSpace; }
      const inside = keep(new THREE.MeshStandardMaterial({ map: innerTexture, color: innerTexture ? 0xffffff : 0xfffefa, roughness: .9, side: THREE.BackSide }));
      const edge = keep(new THREE.MeshStandardMaterial({ color: 0xd1d3d4, roughness: 1, side: THREE.DoubleSide }));
      const line = keep(new THREE.LineBasicMaterial({ color: 0x33536b, transparent: true, opacity: .38 }));
      const slit = keep(new THREE.LineBasicMaterial({ color: 0x33536b, transparent: true, opacity: .8 }));
      const groups = new Map<string, THREE.Group>();
      for (const p of d.panels) {
        const group = new THREE.Group(), parent = d.panels.find(x => x.id === p.parent);
        group.position.set(p.hinge[0] - (parent?.hinge[0] ?? d.centre[0]), (parent?.hinge[1] ?? d.centre[1]) - p.hinge[1], 0);
        (p.parent ? groups.get(p.parent)! : root).add(group); groups.set(p.id, group);
        const shape = new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x - p.hinge[0], p.hinge[1] - y)));
        shape.holes = p.holes.map(hole => new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x - p.hinge[0], p.hinge[1] - y))));
        const geometry = keep(new THREE.ShapeGeometry(shape));
        const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
        for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + p.hinge[0]) / d.sheetWidthMm, 1 - (p.hinge[1] - pos.getY(i)) / d.sheetHeightMm);
        const printed = new THREE.Mesh(geometry, outside); printed.position.z = d.displayThicknessMm / 2;
        const innerGeometry = keep(geometry.clone()), innerUv = innerGeometry.getAttribute('uv');
        for (let i = 0; i < innerUv.count; i++) { const [u, v] = salesFolderInsideUv(d, uv.getX(i), uv.getY(i)); innerUv.setXY(i, u, v); }
        const paper = new THREE.Mesh(innerGeometry, inside); paper.position.z = -d.displayThicknessMm / 2;
        group.add(printed, paper);
        const coords: number[] = [];
        for (const contour of [p.outline, ...p.holes]) contour.forEach(([x, y], i) => {
          const [nx, ny] = contour[(i + 1) % contour.length], a = [x - p.hinge[0], p.hinge[1] - y], b = [nx - p.hinge[0], p.hinge[1] - ny], t = d.displayThicknessMm / 2;
          coords.push(...a, -t, ...b, -t, ...b, t, ...a, -t, ...b, t, ...a, t);
        });
        const edgeGeometry = keep(new THREE.BufferGeometry()); edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3)); edgeGeometry.computeVertexNormals();
        group.add(new THREE.Mesh(edgeGeometry, edge));
        for (const z of [-d.displayThicknessMm / 2 - .002, d.displayThicknessMm / 2 + .002]) {
          for (const contour of [p.outline, ...p.holes]) group.add(new THREE.LineLoop(keep(new THREE.BufferGeometry().setFromPoints(contour.map(([x, y]) => new THREE.Vector3(x - p.hinge[0], p.hinge[1] - y, z)))), line));
          for (const cut of p.cuts ?? []) group.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(cut.map(([x, y]) => new THREE.Vector3(x - p.hinge[0], p.hinge[1] - y, z)))), slit));
        }
      }
      scene.add(new THREE.HemisphereLight(0xffffff, 0xdce4ec, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-400, 700, -700); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, .8); fill.position.set(400, 200, 600); scene.add(fill);
      let selectedView: View = 'angle';
      const view = (next: View) => {
        selectedView = next;
        const spread = next === 'outside' || next === 'inside' || next === 'angle';
        const rootPanel = d.panels[0];
        const xs = rootPanel.outline.map(p => p[0]), ys = rootPanel.outline.map(p => p[1]);
        const width = spread ? d.sheetWidthMm : Math.max(...xs) - Math.min(...xs);
        const height = spread ? d.sheetHeightMm : Math.max(...ys) - Math.min(...ys);
        const distance = Math.max(height, width / Math.max(.1, camera.aspect)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.22;
        const target = next === 'spine' ? new THREE.Vector3(Math.max(...xs) - d.centre[0], height * .35, -d.nominalSpineMm / 2)
          : new THREE.Vector3(spread ? d.sheetWidthMm / 2 - d.centre[0] : 0, spread ? d.centre[1] - d.sheetHeightMm / 2 : 0, -d.nominalSpineMm / 2);
        orbit!.target.copy(target); orbit!.minDistance = next === 'spine' ? 50 : distance * .45; orbit!.maxDistance = distance * 3;
        const direction = next === 'spine' ? new THREE.Vector3(.9, .5, -1) : new THREE.Vector3(next === 'angle' ? -.4 : 0, next === 'angle' ? .3 : 0, next === 'back' || next === 'outside' ? 1 : -1);
        camera.position.copy(direction.normalize().multiplyScalar(next === 'spine' ? 110 : distance).add(target)); orbit!.update();
      };
      api.current = {
        view,
        zoom: factor => { const offset = camera.position.clone().sub(orbit!.target); offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, orbit!.minDistance, orbit!.maxDistance)); camera.position.copy(orbit!.target).add(offset); orbit!.update(); },
        rotate: (x, y) => { const offset = camera.position.clone().sub(orbit!.target), s = new THREE.Spherical().setFromVector3(offset); s.theta += x; s.phi = THREE.MathUtils.clamp(s.phi + y, .05, Math.PI - .05); camera.position.copy(orbit!.target).add(offset.setFromSpherical(s)); orbit!.update(); },
      };
      const resize = () => { const b = element!.getBoundingClientRect(); renderer!.setSize(Math.max(1, b.width), Math.max(1, b.height)); camera.aspect = Math.max(1, b.width) / Math.max(1, b.height); camera.updateProjectionMatrix(); view(selectedView); };
      resize(); observer = new ResizeObserver(resize); observer.observe(element!);
      let displayed = openingRef.current, previous = performance.now();
      const animate = (now: number) => {
        if (disposed) return;
        const dt = Math.min(.1, (now - previous) / 1000); previous = now;
        displayed += (openingRef.current - displayed) * (1 - Math.exp(-12 * dt));
        for (const panel of d.panels) {
          const group = groups.get(panel.id)!;
          const axis = new THREE.Vector3(panel.hingeEnd[0] - panel.hinge[0], panel.hinge[1] - panel.hingeEnd[1], 0).normalize();
          const angle = salesFolderPanelAngle(panel, displayed);
          group.quaternion.setFromAxisAngle(axis, angle);
          // Single creases have no physical gusset; small illustrative bend
          // clearance keeps folded paper faces from occupying the same plane.
          const fraction = panel.angle ? angle / panel.angle : 0;
          group.position.z = panel.layer * Math.sin(fraction * Math.PI / 2);
        }
        orbit!.update(); renderer!.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      setReady(true); frame = requestAnimationFrame(animate);
    }
    void start().catch(failed);
    return () => { disposed = true; cancelAnimationFrame(frame); api.current = null; observer?.disconnect(); orbit?.dispose(); resources.forEach(r => r.dispose()); renderer?.domElement.removeEventListener('webglcontextlost', lost); renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); };
  }, [d, artwork]);
  function preset(percent: number, view: View) { setPlaying(false); setOpening(percent); setViewName(view); api.current?.view(view); }
  return <div className="flat-print-viewer spine-folder-viewer" data-model-revision={d.id} data-sales-folder-ready={ready}>
    <div ref={host} className="flat-print-stage" tabIndex={error ? -1 : 0} role="group" aria-label="3D-salgsmappe. Piletaster drejer. Plus og minus zoomer."
      onKeyDown={e => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key)) return; e.preventDefault(); if (e.key.startsWith('Arrow')) api.current?.rotate(e.key === 'ArrowLeft' ? -.15 : e.key === 'ArrowRight' ? .15 : 0, e.key === 'ArrowUp' ? -.15 : e.key === 'ArrowDown' ? .15 : 0); else api.current?.zoom(e.key === '-' ? 1.12 : .89); }} />
    {!ready && !error && <p role="status">Åbner 3D…</p>}
    {error ? <div className="flat-print-fallback"><p role="alert">{error}</p><img src={artwork.outside} alt="Ydersidens udfoldede trykflade" /></div> : <>
      <div className="half-fold-slider"><label htmlFor="spine-opening">Åbning <strong>{Math.round(opening)} %</strong></label><input id="spine-opening" type="range" min="0" max="100" value={opening} disabled={!ready} onChange={e => { setPlaying(false); setOpening(Number(e.target.value)); if (viewName === 'spine') { setViewName('angle'); api.current?.view('angle'); } }} /><div><span>Lukket</span><span>Helt udfoldet</span></div></div>
      <p className="roll-fold-step">{viewName === 'spine' ? `Ryg i nærbillede · ${d.nominalSpineMm} mm kapacitet. Den målte konstruktion og kartonens kant er synlige.` : opening < 45 ? 'Forsiden åbner først.' : opening < 70 ? 'Mappens indvendige flader foldes ud.' : 'Klapperne åbner til det flade trykark.'}</p>
      <div className="flat-print-controls" aria-label="Foldning og sider">
        <button disabled={!ready} onClick={() => preset(0,'front')}>Forside · 1</button>
        <button disabled={!ready} onClick={() => preset(0,'back')}>Bagside · {d.readerPages}</button>
        <button disabled={!ready} onClick={() => preset(45,'inside')}>Åben mappe</button>
        <button disabled={!ready} onClick={() => preset(70,'angle')}>Fold klapper ud</button>
        <button disabled={!ready} onClick={() => preset(100,'outside')}>Fladt trykark</button>
        <button disabled={!ready} onClick={() => preset(0,'spine')}>Se {d.nominalSpineMm} mm ryg</button>
        <button disabled={!ready} onClick={() => preset(30,'angle')}>3D-vinkel</button>
        <button disabled={!ready} onClick={() => { if (!playing) { api.current?.view('angle'); setViewName('angle'); setOpening(100); } setPlaying(v => !v); }}>{playing ? 'Pause foldning' : 'Afspil foldning'}</button>
        <button disabled={!ready} aria-label="Zoom ind" onClick={() => api.current?.zoom(.85)}>+</button><button disabled={!ready} aria-label="Zoom ud" onClick={() => api.current?.zoom(1.18)}>−</button>
      </div>
    </>}
  </div>;
}
